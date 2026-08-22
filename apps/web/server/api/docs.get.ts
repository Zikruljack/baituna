export default defineEventHandler((event) => {
  setHeader(event, 'content-type', 'text/html; charset=utf-8');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Baituna API</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"></head>
<body><div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({url:'/api/openapi.json',dom_id:'#swagger-ui'});</script></body></html>`;
});
