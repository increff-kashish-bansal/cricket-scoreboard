# Cricket Scoreboard - React + Vite

## How to Deploy (Azure Static Web Apps)

1. **Build the app:**
   ```sh
   npm run build
   ```
2. **Deploy to Azure Static Web Apps:**
   ```sh
   swa deploy dist --deployment-token <your-deployment-token>
   ```
   Replace `<your-deployment-token>` with the value from Azure portal or CLI:
   ```sh
   az staticwebapp secrets list --name cricket-scoreboard --resource-group rg-ms-enterprise-qc-02
   ```

3. **If you update staticwebapp.config.json or public/ticket.csv, repeat the above steps.**

---

## Production Deployment

This app is deployed to Azure Static Web Apps:
[https://ashy-mud-0cc393c0f-preview.eastus2.2.azurestaticapps.net](https://ashy-mud-0cc393c0f-preview.eastus2.2.azurestaticapps.net)

### Client-side Routing

This app uses React Router. The file `public/staticwebapp.config.json` ensures client-side routes work correctly on Azure Static Web Apps.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
