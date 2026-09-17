# Beijing Property Showcase

集团在京房产智能管理系统的只读静态成果展示版。

本项目只包含公开安全的前端展示代码和 10 条明确标记的虚构房产数据，用于演示指标概览、搜索、筛选、地图/列表联动及只读详情。项目不包含后端、账号体系、数据库或任何写入能力。

## 本地运行

```bash
npm ci
npm run dev
```

## 测试与构建

```bash
npm test
npm run build
npm run audit:public
```

面向仓库名 `beijing-property-showcase` 的 GitHub Pages 构建：

```powershell
$env:SHOWCASE_BASE_PATH='/beijing-property-showcase/'
npm run build
```

本地根路径开发时不设置 `SHOWCASE_BASE_PATH`，默认使用 `/`。

## 天地图显示配置

公开部署使用单独申请的浏览器端展示 Key，并通过 GitHub Repository Secret `VITE_TIANDITU_SHOWCASE_KEY` 在构建时注入。该应用的域名白名单限制为 `suchixiang-cell.github.io`，并只开放地图矢量与注记显示所需权限。

未配置 Key 时，应用保持可用并使用无网络底图的降级展示。Search V2、地理编码、真实地址提交和真实业务数据均被有意排除。

## 数据与许可

- 所有房产、单位、人员、地址和坐标均为虚构或合成演示内容。
- 请勿向本项目添加真实房产或个人信息。
- License: not yet specified.
