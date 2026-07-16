import bcrypt from "bcryptjs";

const password = process.argv[2];

if (!password) {
  console.error("Usage: npx tsx scripts/hash-password.ts <password>");
  process.exit(1);
}

bcrypt.hash(password, 12).then((hash) => {
  // Escaped for .env.local: Next.js's env loader expands unescaped `$word`
  // as a variable reference, which silently corrupts bcrypt hashes.
  console.log(hash.replaceAll("$", "\\$"));
});
