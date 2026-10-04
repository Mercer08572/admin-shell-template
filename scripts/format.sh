#!/usr/bin/env bash
# 统一的代码格式化入口。
#
# 用法：
#   bash scripts/format.sh                    # 格式化全仓
#   bash scripts/format.sh src/api tests      # 只格式化指定路径
#   bash scripts/format.sh --check            # 全仓只检查（CI 与 pnpm check 走这条）
#   bash scripts/format.sh --check src/api    # 只检查指定路径
#
# 为什么需要这个脚本：pnpm 会把附加参数**追加**到脚本命令末尾，因此
# `"format": "prettier . --write"` 这种写法里 `.` 永远在，用户传的路径只会被追加、
# 不会收窄范围（prettier 把多个位置参数视为并集）。必须由脚本自己决定
# 「无参 = 全仓，有参 = 只处理传参」。
#
# 注意：`"$@"` 逐参数传递，含空格的路径不会碎；末尾用 exec 保证 prettier 的退出码
# 原样冒泡（pnpm check 与 CI 依赖它）。

set -euo pipefail

mode="--write"
if [ "${1:-}" = "--check" ]; then
  mode="--check"
  shift
fi

if [ "$#" -eq 0 ]; then
  set -- .
fi

exec ./node_modules/.bin/prettier "$mode" "$@"
