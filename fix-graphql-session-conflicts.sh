#!/bin/bash

echo "🔥 Fixing ALL session mutation conflicts (open + close)..."

# ============================
# PAPER SCHEMA
# ============================
sed -i 's/openSession(/openPaperSession(/g' src/graphql/schema/paperSchema.ts
sed -i 's/closeSession(/closePaperSession(/g' src/graphql/schema/paperSchema.ts

# ============================
# EXAM SCHEMA
# ============================
sed -i 's/openSession(/openExamSession(/g' src/graphql/schema/examSchema.ts
sed -i 's/closeSession(/closeExamSession(/g' src/graphql/schema/examSchema.ts

# ============================
# RESOLVERS
# ============================
sed -i 's/openSession/openPaperSession/g' src/graphql/resolvers/paperResolvers/mutations.ts
sed -i 's/closeSession/closePaperSession/g' src/graphql/resolvers/paperResolvers/mutations.ts

sed -i 's/openSession/openExamSession/g' src/graphql/resolvers/examResolvers/mutations.ts
sed -i 's/closeSession/closeExamSession/g' src/graphql/resolvers/examResolvers/mutations.ts

# ============================
# CLEAN CACHE
# ============================
rm -rf dist node_modules/.cache

echo "✅ DONE - Restart server now"
