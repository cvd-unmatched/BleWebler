#!/usr/bin/env bash
# Create an annotated tag and push it (triggers GitHub Actions -> GHCR build).
# Version is derived entirely from git tags -- no VERSION file or package.json to keep
# in sync, since BleWebler is a static site with no build step or npm dependencies.
# Run from repo root: ./release.sh [options] <major|minor|patch|rc> [prerelease]

set -euo pipefail

CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GREEN='\033[0;32m'
WHITE='\033[1;37m'
GRAY='\033[0;90m'
NC='\033[0m'

usage() {
  echo "Usage: $0 [--keep-base-version|-k] <major|minor|patch|rc> [prerelease]" >&2
  echo "  Examples:" >&2
  echo "    $0 patch              # bump patch (offers patch, minor, major if you decline)" >&2
  echo "    $0 rc                 # prerelease only, auto rc1, rc2, …" >&2
  echo "    $0 --keep-base rc2    # set version to X.Y.Z-rc2 without bumping X.Y.Z" >&2
  exit "${1:-1}"
}

get_next_prerelease() {
  local existing="${1:-}"
  local default_prefix="${2:-rc}"
  if [[ -z "${existing// }" ]]; then
    echo "${default_prefix}1"
    return
  fi
  if [[ "$existing" =~ ^([A-Za-z]+)\.?([0-9]+)$ ]]; then
    local prefix="${BASH_REMATCH[1]}"
    local num="${BASH_REMATCH[2]}"
    echo "${prefix}$((num + 1))"
    return
  fi
  echo "${existing}1"
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

KEEP_BASE=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help) usage 0 ;;
    --keep-base-version|-k) KEEP_BASE=1; shift ;;
    --) shift; break ;;
    -*) echo -e "${RED}Unknown option: $1${NC}" >&2; usage ;;
    *) break ;;
  esac
done

TYPE="${1:-patch}"
PRERELEASE="${2:-}"

case "$TYPE" in
  major|minor|patch|rc) ;;
  *) echo -e "${RED}Invalid type: $TYPE (use major, minor, patch, or rc)${NC}" >&2; usage ;;
esac

echo -e "${CYAN}BleWebler release${NC}"
echo -e "${CYAN}===================================${NC}"

# Version comes from the latest "vX.Y.Z" tag reachable in this repo. No tags yet?
# Start from 0.0.0 so the chosen bump type (patch/minor/major) sets the first version.
latest_tag="$(git tag -l 'v*' --sort=-v:refname | head -n1 || true)"
current_version="${latest_tag#v}"
if [[ -z "$current_version" ]]; then
  current_version="0.0.0"
fi

if ! [[ "$current_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]; then
  echo -e "${RED}Invalid version derived from latest tag '$latest_tag': $current_version${NC}" >&2
  exit 1
fi

current_prerelease=""
if [[ "$current_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+-(.+)$ ]]; then
  current_prerelease="${BASH_REMATCH[1]}"
fi

if [[ "$TYPE" == "rc" ]]; then
  KEEP_BASE=1
  if [[ -z "$PRERELEASE" ]]; then
    PRERELEASE="$(get_next_prerelease "$current_prerelease" "rc")"
    echo -e "${YELLOW}Auto-incremented prerelease to '$PRERELEASE'${NC}"
  fi
fi

if [[ "$KEEP_BASE" -eq 1 ]] && [[ -z "$PRERELEASE" ]]; then
  PRERELEASE="$(get_next_prerelease "$current_prerelease" "rc")"
  echo -e "${YELLOW}Auto-incremented prerelease to '$PRERELEASE'${NC}"
fi

base_version="${current_version%%-*}"
IFS='.' read -r major minor patch <<< "$base_version"
major=$((10#$major))
minor=$((10#$minor))
patch=$((10#$patch))

compute_release_info() {
  local release_type="$1"
  local new_major=$major new_minor=$minor new_patch=$patch
  local new_version type_name

  if [[ "$KEEP_BASE" -eq 1 ]] || [[ "$release_type" == "rc" ]]; then
    type_name="Prerelease"
    new_version="$base_version"
    if [[ -n "$PRERELEASE" ]]; then
      new_version="${base_version}-${PRERELEASE}"
    fi
  else
    case "$release_type" in
      major)
        new_major=$((new_major + 1))
        new_minor=0
        new_patch=0
        type_name="Major"
        ;;
      minor)
        new_minor=$((new_minor + 1))
        new_patch=0
        type_name="Minor"
        ;;
      patch)
        new_patch=$((new_patch + 1))
        type_name="Patch"
        ;;
    esac
    new_version="${new_major}.${new_minor}.${new_patch}"
    if [[ -n "$PRERELEASE" ]]; then
      new_version="${new_version}-${PRERELEASE}"
    fi
  fi
  NEW_VERSION="$new_version"
  TAG="v${new_version}"
  RELEASE_TYPE_NAME="$type_name"
}

confirm_release() {
  local release_type="$1"
  compute_release_info "$release_type"

  echo -e "${YELLOW}Release Information:${NC}"
  echo -e "  ${WHITE}Current Version:${NC} $current_version"
  echo -e "  ${WHITE}Release Type:${NC} $RELEASE_TYPE_NAME"
  echo -e "  ${GREEN}New Version:${NC} $NEW_VERSION"
  echo -e "${CYAN}  Tag:${NC} $TAG"
  if [[ -n "${PRERELEASE:-}" ]]; then
    echo -e "${CYAN}  Pre-Release:${NC} $PRERELEASE"
  fi
  echo ""

  if git tag -l "$TAG" | grep -qxF "$TAG"; then
    echo -e "${RED}Tag $TAG already exists${NC}" >&2
    return 1
  fi

  echo -e "${YELLOW}Do you want to create $RELEASE_TYPE_NAME release $NEW_VERSION? (y/N)${NC}"
  local response
  if [[ -t 0 ]]; then
    read -r response
  else
    read -r response </dev/tty
  fi
  response="${response//$'\r'/}"
  response="$(echo "$response" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  if [[ "$response" =~ ^[Yy]$ ]]; then
    return 0
  fi
  return 1
}

if [[ -n "$(git status --porcelain 2>/dev/null)" ]]; then
  echo -e "${YELLOW}You have uncommitted changes${NC}"
  echo -e "${YELLOW}Please commit or stash your changes before creating a release.${NC}"
  exit 1
fi

if [[ "$KEEP_BASE" -eq 0 ]] && [[ "$TYPE" != "rc" ]]; then
  release_types=(patch minor major)
  current_index=0
  for i in "${!release_types[@]}"; do
    if [[ "${release_types[$i]}" == "$TYPE" ]]; then
      current_index=$i
      break
    fi
  done

  confirmed=0
  for (( i = current_index; i < ${#release_types[@]}; i++ )); do
    rt="${release_types[$i]}"
    if confirm_release "$rt"; then
      TYPE="$rt"
      confirmed=1
      break
    fi
    if [[ $i -lt $((${#release_types[@]} - 1)) ]]; then
      echo -e "${CYAN}Trying next release type...${NC}"
    fi
  done
  if [[ "$confirmed" -ne 1 ]]; then
    echo -e "${YELLOW}Release cancelled${NC}"
    exit 0
  fi
else
  if ! confirm_release "$TYPE"; then
    echo -e "${YELLOW}Release cancelled${NC}"
    exit 0
  fi
fi

compute_release_info "$TYPE"

echo -e "${YELLOW}Creating tag $TAG...${NC}"
if ! git tag -a "$TAG" -m "$RELEASE_TYPE_NAME release version $NEW_VERSION"; then
  echo -e "${RED}Failed to create tag${NC}" >&2
  exit 1
fi

current_branch="$(git rev-parse --abbrev-ref HEAD)"
echo -e "${YELLOW}Pushing branch '$current_branch' and tag to origin...${NC}"
if ! git push origin "$current_branch"; then
  echo -e "${RED}Failed to push branch${NC}" >&2
  exit 1
fi
if ! git push origin "$TAG"; then
  echo -e "${RED}Failed to push tag${NC}" >&2
  exit 1
fi

echo ""
echo -e "${GREEN}$RELEASE_TYPE_NAME release $NEW_VERSION created and pushed successfully!${NC}"
echo ""
echo -e "${CYAN}What happens next (GitHub Actions):${NC}"
echo "  1. Workflow runs on tag push (Release)"
echo "  2. Docker image is pushed to GitHub Container Registry (ghcr.io)"
echo "  3. After the job succeeds, pull with:"
echo ""

remote="$(git config --get remote.origin.url 2>/dev/null || true)"
owner=""
repo=""
if [[ "$remote" =~ git@github\.com:([^/]+)/([^/.]+)(\.git)?$ ]]; then
  owner="${BASH_REMATCH[1]}"
  repo="${BASH_REMATCH[2]%.git}"
elif [[ "$remote" =~ github\.com[:/]([^/]+)/([^/.]+)(\.git)?$ ]]; then
  owner="${BASH_REMATCH[1]}"
  repo="${BASH_REMATCH[2]%.git}"
fi

if [[ -n "$owner" && -n "$repo" ]]; then
  gh_repo_lc="$(echo "${owner}/${repo}" | tr '[:upper:]' '[:lower:]')"
  image_name="ghcr.io/${gh_repo_lc}"
else
  image_name="ghcr.io/<owner>/<repo>"
fi

echo -e "${GRAY}     docker pull ${image_name}:${TAG}${NC}"
echo -e "${GRAY}     docker pull ${image_name}:latest${NC}"
echo ""
if [[ -n "$owner" && -n "$repo" ]]; then
  repo_lc="$(echo "$repo" | tr '[:upper:]' '[:lower:]')"
  echo -e "${CYAN}Packages:${NC} https://github.com/${owner}/${repo}/pkgs/container/${repo_lc}"
fi
echo ""
