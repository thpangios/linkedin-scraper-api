FROM node:18.19-slim

# Install all required dependencies for modern headless Chromium
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    libxshmfence1 \
    libxcb-dri3-0 \
    libdrm2 \
    libgbm1 \
    libxinerama1 \
    libxext6 \
    libxfixes3 \
    libgl1 \
    xdg-utils \
    gnupg \
    lsb-release \
    software-properties-common \
    --no-install-recommends && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Optional: add non-root user (safer puppeteer context)
RUN useradd -m puppeteer

WORKDIR /app
COPY . .

RUN npm install
# Ensure compatibility with Puppeteer 24.x
RUN npm run build
RUN npm run build

USER puppeteer

CMD ["node", "-r", "dotenv/config", "dist/examples/server.js"]
