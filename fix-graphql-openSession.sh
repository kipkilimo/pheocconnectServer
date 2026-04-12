#!/bin/bash

echo "🔥 Fixing GraphQL openSession conflicts..."

# Fix schema files
sed -i 's/openSession(/openPaperSession(/g' src/graphql/schema/paperSchema.ts
sed -i 's/openSession(/openExamSession(/g' src/graphql/schema/examSchema.ts

# Fix resolver files
sed -i 's/openSession/openPaperSession/g' src/graphql/resolvers/paperResolvers/mutations.ts
sed -i 's/openSession/openExamSession/g' src/graphql/resolvers/examResolvers/mutations.ts

echo "🧹 Cleaning build cache..."
rm -rf dist node_modules/.cache

echo "✅ DONE. Now restart server."
