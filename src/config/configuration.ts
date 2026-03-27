export default () => ({
  app: {
    port: Number(process.env.PORT ?? 3000),
    jwtSecret: process.env.JWT_SECRET ?? 'your_jwt_secret',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  },
  database: {
    uri: process.env.MONGO_URL ?? 'mongodb://localhost:27017/chat_system',
  },
});
