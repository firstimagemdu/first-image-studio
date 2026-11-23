FROM node:20-alpine
WORKDIR /app
COPY package.json server.js First_Image_Studio_ERP_v70.html ./
COPY public ./public
ENV PORT=3000
ENV DATA_DIR=/app/data
RUN mkdir -p /app/data/backups
EXPOSE 3000
CMD ["npm", "start"]
