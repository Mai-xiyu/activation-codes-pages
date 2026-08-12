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
  - `ACTIVATION_CODES_ENDPOINT`：`https://starxserver.vercel.app/api/admin/list`
  - `ACTIVATION_CODES_TOKEN`：StarX 管理密钥。当前代码里对应 `StarXManager/manager_gui.py` 的 `ADMIN_SECRET`。
3. 在 Actions 手动运行 `Sync activation codes`，确认 `data/activation-codes.json` 被更新。
4. 在 Settings -> Pages 选择 `Deploy from a branch`，分支选 `main`，目录选 `/root`。

当前 StarX 服务器没有单独的公开只读接口；管理工具也是通过 `POST /api/admin/list` 加 `Authorization: Bearer <ADMIN_SECRET>` 获取列表。同步脚本会在 GitHub Actions 里使用 Secret 调接口，然后只把公开白名单字段写入 `data/activation-codes.json`。管理员密钥、设备 ID、后台原始响应不会写入前端仓库。

## 隐私激活码

后台生成激活码时支持 `private: true` 标记（发给赞助者等私密渠道的码）。此类激活码：

- 服务器 `/api/admin/list` 默认不返回（只有管理工具显式传 `include_private: true` 才能看到）；
- 同步脚本也会再过滤一遍 `private` / `privacy` / `is_private` 字段为真的记录（双保险），
  保证隐私码永远不会写入本仓库的 `data/activation-codes.json` 并出现在 GitHub Pages 上。

隐私码的激活、续期与普通码完全一致，只是不公开。

## 后台接口格式

同步脚本支持数组，或对象中的 `codes` / `data` / `items` 数组。当前 StarX 管理接口返回字段类似：

```json
{
  "ok": true,
  "codes": [
    {
      "code": "STARX-XXXX-XXXX",
      "duration_days": 30,
      "device_id": "设备指纹，只在后台响应里存在，不会写入公开 JSON",
      "activated_at": 1778400000000
    }
  ]
}
```

脚本会把它转换成：

```json
{
  "code": "STARX-XXXX-XXXX",
  "status": "used",
  "plan": "30 天",
  "label": "已绑定设备",
  "expiresAt": "2026-06-10T00:00:00.000Z",
  "maxUses": 1,
  "remainingUses": 0,
  "usedCount": 1
}
```

脚本会丢弃非白名单字段，不会把 `device_id`、管理员密钥或后台原始响应写入仓库。
