# Anchor Check-In

## Local Auth Setup

1. Apply the database schema:

```sh
pnpm --filter @workspace/db run push
```

2. Create the first owner account:

```sh
ORG_NAME="Oakwood Bible Chapel" \
OWNER_EMAIL="james@example.com" \
OWNER_FIRST_NAME="James" \
OWNER_LAST_NAME="Dureno" \
OWNER_PASSWORD="temporaryPassword123" \
PLAN="basic" \
SUBSCRIPTION_STATUS="trialing" \
pnpm create:owner
```

3. Start the app and sign in at `/login`.

Create or promote a platform super-admin account locally:

```sh
SUPER_ADMIN_EMAIL="myemail@example.com" \
SUPER_ADMIN_FIRST_NAME="James" \
SUPER_ADMIN_LAST_NAME="Dureno" \
SUPER_ADMIN_PASSWORD="strong-password-here" \
pnpm create:super-admin
```

There is no public signup, setup-first-admin page, or browser-based organization creation flow. Account creation is command-line only.

## Railway Account Creation

Create an owner account from your local terminal with Railway CLI:

```sh
railway run \
  ORG_NAME="Oakwood Bible Chapel" \
  OWNER_EMAIL="james@example.com" \
  OWNER_FIRST_NAME="James" \
  OWNER_LAST_NAME="Dureno" \
  OWNER_PASSWORD="temporaryPassword123" \
  PLAN="basic" \
  SUBSCRIPTION_STATUS="trialing" \
  pnpm create:owner
```

Add a staff/tester account:

```sh
railway run \
  ORG_NAME="Oakwood Bible Chapel" \
  USER_EMAIL="volunteer@example.com" \
  USER_FIRST_NAME="Volunteer" \
  USER_LAST_NAME="User" \
  USER_PASSWORD="temporaryPassword123" \
  ROLE="staff" \
pnpm create:user
```

Create or promote a platform super-admin account through Railway:

```sh
railway run \
  SUPER_ADMIN_EMAIL="myemail@example.com" \
  SUPER_ADMIN_FIRST_NAME="James" \
  SUPER_ADMIN_LAST_NAME="Dureno" \
  SUPER_ADMIN_PASSWORD="strong-password-here" \
  pnpm create:super-admin
```
