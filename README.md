# Project Setup and Running Instructions

## Prerequisites

- Ensure you have Homebrew installed. If not, you can get it from [Homebrew's website](https://brew.sh/).
- Install `pnpm` if you haven’t already. Follow the instructions [here](https://pnpm.io/installation).

## PostgreSQL Installation and Configuration

1. **Install PostgreSQL:**
   ```bash
   brew install postgresql
   ```

2. **Start PostgreSQL:**
   ```bash
   brew services start postgresql@14
   ```

3. **Access PostgreSQL:**
   ```bash
   psql postgres
   ```

4. **Create PostgreSQL User and Database:**
   ```sql
   CREATE USER postgres WITH SUPERUSER;
   \q
   sudo su
   psql -U postgres
   CREATE DATABASE seryu_dev;
   CREATE USER exp1tc WITH PASSWORD '<><><>';
   GRANT ALL PRIVILEGES ON DATABASE seryu_dev TO exp1tc;
   ```

5. **Import Data:**
   ```bash
   psql -U exp1tc -d seryu_dev -a -f migration.sql
   ```
   *Note: You can use any method to import CSV or seed data as required.*

## Environment Configuration

1. **Set Environment Variables:**
   Create a `.env` file in the root directory of your project and add the following line:
   ```env
   DATABASE_URL="postgresql://exp1tc:<><><>@localhost:5432/seryu_dev?schema=public"
   ```

## Project Setup

1. **Install Dependencies:**
   ```bash
   pnpm i
   ```

2. **Sync Prisma Schema:**
   If you have not modified the main flow and only added indexing or error handling, you can skip `pnpm prisma db pull` and use `pnpm prisma db push` to sync the schema:
   ```bash
   pnpm prisma db push
   ```

3. **Build the Project:**
   ```bash
   pnpm build
   ```

4. **Start the Project:**
   ```bash
   pnpm start
   ```
   Alternatively, you can use:
   ```bash
   pnpm dev
   ```

## Notes

- The `pnpm prisma db pull` command may display warnings about constraints. These warnings are informational and do not affect the functionality since constraints are manually set.
