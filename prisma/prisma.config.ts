import { defineConfig } from '@prisma/internals';

export default defineConfig({
  datasource: {
    provider: 'sqlite',
    url: 'file:./dev.db',
  },
});
