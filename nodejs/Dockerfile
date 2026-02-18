FROM node:lts

WORKDIR /app

# Create user/group early
RUN groupadd -g 1001 nodejs \
 && useradd -u 1001 -g nodejs -s /bin/bash -m nodejs

# Copy manifests (small) first
COPY package*.json ./

# Give ownership only to what exists so far (tiny)
RUN chown -R nodejs:nodejs /app

# Install deps as the unprivileged user so node_modules is owned correctly
USER nodejs
RUN npm i

# Copy the rest of your app; keep ownership correct without chown -R
# (If your Docker supports it)
USER root
COPY --chown=nodejs:nodejs . .

# Create writable runtime dir
RUN mkdir -p /app/data && chown -R nodejs:nodejs /app/data

USER nodejs

EXPOSE 3001
CMD ["npm", "start"]
