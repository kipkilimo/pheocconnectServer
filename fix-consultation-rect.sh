#!/bin/bash

FILE="src/graphql/consultationTypeDefs.ts"

echo "🚀 Starting ConsultationRect refactor..."

# 1. Replace type Rect → ConsultationRect
sed -i 's/type Rect/type ConsultationRect/g' "$FILE"

# 2. Replace RectInput → ConsultationRectInput
sed -i 's/RectInput/ConsultationRectInput/g' "$FILE"

# 3. Fix field usage: rect: Rect! → rect: ConsultationRect!
sed -i 's/rect: Rect!/rect: ConsultationRect!/g' "$FILE"

# 4. Fix input usage inside AnnotationInput
sed -i 's/rect: RectInput!/rect: ConsultationRectInput!/g' "$FILE"

# 5. Fix any leftover exact Rect references (safe guard)
sed -i 's/\bRect\b/ConsultationRect/g' "$FILE"

echo "✅ Refactor complete!"
echo "👉 Please restart your server:"
echo "   npm run dev"
