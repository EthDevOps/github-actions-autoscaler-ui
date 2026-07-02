FROM nginx

# SPA build output
COPY dist/ /usr/share/nginx/html/

# nginx config template. The official image's entrypoint runs envsubst over
# /etc/nginx/templates/*.template into /etc/nginx/conf.d/ at container start,
# substituting only the env vars below (nginx $variables are left untouched).
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

# Upstream orchestrator the /api location proxies to. Override in the deployment
# if you want to route to the in-cluster service instead of the public address.
ENV ORCHESTRATOR_URL=https://github-autoscaler.ethquokkaops.io
ENV ORCHESTRATOR_HOST=github-autoscaler.ethquokkaops.io
