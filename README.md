# StarX Activation Codes Pages

用于 GitHub Pages 的静态激活码发放看板。

## 目录

- `index.html`：页面入口
- `assets/app.js`：只读取公开 JSON，并且只展示白名单字段
- `assets/styles.css`：页面样式
- `data/activation-codes.json`：GitHub Pages 实际读取的数据文件
- `scripts/sync-activation-codes.mjs`：用 GitHub Secrets 从后台拉取数据并输出公开字段
- `.github/workflows/sync-activation-codes.yml`：定时同步公开数据

## 数据边界

前端仓库只允许出现这些公开字段：

- `code`
- `status`
- `plan`
- `label`
- `issuedAt`
- `expiresAt`
- `maxUses`
- `remainingUses`
- `usedCount`

不要把管理员账号、管理员 Token、用户手机号、邮箱、设备 ID、后台原始响应提交到仓库。

## GitHub Pages

推荐使用 `main` 分支根目录部署：

1. 推送这个仓库到 GitHub。
2. 在仓库 Settings -> Secrets and variables -> Actions 添加：
   - `ACTIVATION_CODES_ENDPOINT`：后台只读接口地址
   - `ACTIVATION_CODES_TOKEN`：后台只读接口 Token
3. 在 Actions 手动运行 `Sync activation codes`，确认 `data/activation-codes.json` 被更新。
4. 在 Settings -> Pages 选择 `Deploy from a branch`，分支选 `main`，目录选 `/root`。

## 后台接口格式

同步脚本支持数组，或对象中的 `codes` / `data` / `items` 数组：

```json
{
  "codes": [
    {
      "code": "STARX-XXXX-XXXX",
      "status": "active",
      "plan": "Pro",
      "label": "公开发放",
      "issuedAt": "2026-05-10T00:00:00.000Z",
      "expiresAt": "2026-06-10T00:00:00.000Z",
      "maxUses": 1,
      "usedCount": 0
    }
  ]
}
```

脚本会丢弃非白名单字段，不会把后台原始响应写入仓库。
