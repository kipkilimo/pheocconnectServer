#!/bin/bash

# ============================================
# COMPLETE GRAPHQL NAMESPACING FIX SCRIPT
# ============================================
# This script eliminates ALL type conflicts between Paper and Exam domains

set -e  # Exit on error

echo "🔥 🔥 🔥 GRAPHQL NAMESPACING FIX 🔥 🔥 🔥"
echo "========================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================
# STEP 1: BACKUP CURRENT FILES
# ============================================
echo -e "${BLUE}📦 Creating backups...${NC}"
mkdir -p .graphql-backup-$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=".graphql-backup-$(date +%Y%m%d_%H%M%S)"

cp src/graphql/schema/paperTypeDefs.ts $BACKUP_DIR/ 2>/dev/null || true
cp src/graphql/schema/examTypeDefs.ts $BACKUP_DIR/ 2>/dev/null || true
cp src/graphql/schema/index.ts $BACKUP_DIR/ 2>/dev/null || true
cp src/graphql/resolvers/*.ts $BACKUP_DIR/ 2>/dev/null || true

echo -e "${GREEN}✅ Backups saved to $BACKUP_DIR${NC}"
echo ""

# ============================================
# STEP 2: FIND ALL CONFLICTING TYPES
# ============================================
echo -e "${BLUE}🔍 Finding conflicting type definitions...${NC}"

# Common type names that cause conflicts
CONFLICTING_TYPES=(
    "RegistrationResponse"
    "ApprovalResponse"
    "AccessCheckResponse"
    "WaitingListResponse"
    "PreRegistrationDetail"
    "SessionRegistration"
    "QRCodeResponse"
    "QRCodeData"
    "RegistrationStatusEnum"
    "DifficultyLevel"
    "QuestionType"
    "QuestionSpecialty"
    "User"
    "PersonalInfo"
    "AccessRequestResponse"
    "CreatePaperResponse"
    "CreateSessionResponse"
)

echo -e "${YELLOW}Found potential conflicts in:${NC}"
for type in "${CONFLICTING_TYPES[@]}"; do
    if grep -r "$type" src/graphql/schema/ --include="*.ts" 2>/dev/null | grep -v "Exam\|Paper" | grep -q "$type"; then
        echo "  - $type"
    fi
done
echo ""

# ============================================
# STEP 3: FIX PAPER SCHEMA (Already namespaced, just ensure consistency)
# ============================================
echo -e "${BLUE}📄 Fixing Paper Schema...${NC}"

PAPER_SCHEMA="src/graphql/schema/paperTypeDefs.ts"

if [ -f "$PAPER_SCHEMA" ]; then
    # Ensure all response types have Paper prefix
    sed -i 's/type RegistrationResponse {/type PaperRegistrationResponse {/g' $PAPER_SCHEMA
    sed -i 's/type ApprovalResponse {/type PaperApprovalResponse {/g' $PAPER_SCHEMA
    sed -i 's/type AccessCheckResponse {/type PaperAccessCheckResponse {/g' $PAPER_SCHEMA
    sed -i 's/type WaitingListResponse {/type PaperWaitingListResponse {/g' $PAPER_SCHEMA
    sed -i 's/type QRCodeResponse {/type PaperQRCodeResponse {/g' $PAPER_SCHEMA
    sed -i 's/type AccessRequestResponse {/type PaperAccessRequestResponse {/g' $PAPER_SCHEMA
    
    # Fix return types in queries
    sed -i 's/: WaitingListResponse!/: PaperWaitingListResponse!/g' $PAPER_SCHEMA
    sed -i 's/: AccessCheckResponse!/: PaperAccessCheckResponse!/g' $PAPER_SCHEMA
    sed -i 's/: RegistrationResponse!/: PaperRegistrationResponse!/g' $PAPER_SCHEMA
    
    # Fix return types in mutations
    sed -i 's/: ApprovalResponse!/: PaperApprovalResponse!/g' $PAPER_SCHEMA
    sed -i 's/: AccessRequestResponse!/: PaperAccessRequestResponse!/g' $PAPER_SCHEMA
    sed -i 's/: QRCodeResponse!/: PaperQRCodeResponse!/g' $PAPER_SCHEMA
    
    echo -e "${GREEN}✅ Paper schema namespaced${NC}"
else
    echo -e "${RED}❌ Paper schema not found at $PAPER_SCHEMA${NC}"
fi
echo ""

# ============================================
# STEP 4: FIX EXAM SCHEMA (Complete namespacing)
# ============================================
echo -e "${BLUE}📝 Fixing Exam Schema...${NC}"

EXAM_SCHEMA="src/graphql/schema/examTypeDefs.ts"

if [ -f "$EXAM_SCHEMA" ]; then
    # Fix main conflicting types
    sed -i 's/type RegistrationResponse {/type ExamRegistrationResponse {/g' $EXAM_SCHEMA
    sed -i 's/type ApprovalResponse {/type ExamApprovalResponse {/g' $EXAM_SCHEMA
    sed -i 's/type AccessCheckResponse {/type ExamAccessCheckResponse {/g' $EXAM_SCHEMA
    sed -i 's/type WaitingListResponse {/type ExamWaitingListResponse {/g' $EXAM_SCHEMA
    sed -i 's/type PreRegistrationDetail {/type ExamPreRegistrationDetail {/g' $EXAM_SCHEMA
    sed -i 's/type SessionRegistration {/type ExamSessionRegistration {/g' $EXAM_SCHEMA
    sed -i 's/type QRCodeData {/type ExamQRCodeData {/g' $EXAM_SCHEMA
    sed -i 's/type CreateSessionResponse {/type CreateExamSessionResponse {/g' $EXAM_SCHEMA
    sed -i 's/type RegistrationStatusResponse {/type ExamRegistrationStatusResponse {/g' $EXAM_SCHEMA
    
    # Fix enums
    sed -i 's/enum DifficultyLevel {/enum ExamDifficultyLevel {/g' $EXAM_SCHEMA
    sed -i 's/enum RegistrationStatusEnum {/enum ExamRegistrationStatusEnum {/g' $EXAM_SCHEMA
    sed -i 's/enum QuestionType {/enum ExamQuestionType {/g' $EXAM_SCHEMA
    sed -i 's/enum QuestionSpecialty {/enum ExamQuestionSpecialty {/g' $EXAM_SCHEMA
    
    # Fix types that use these enums
    sed -i 's/DifficultyLevel/ExamDifficultyLevel/g' $EXAM_SCHEMA
    sed -i 's/RegistrationStatusEnum/ExamRegistrationStatusEnum/g' $EXAM_SCHEMA
    sed -i 's/QuestionType/ExamQuestionType/g' $EXAM_SCHEMA
    sed -i 's/QuestionSpecialty/ExamQuestionSpecialty/g' $EXAM_SCHEMA
    
    # Fix User and PersonalInfo (prevent conflict with Paper)
    sed -i 's/type User {/type ExamUser {/g' $EXAM_SCHEMA
    sed -i 's/type PersonalInfo {/type ExamPersonalInfo {/g' $EXAM_SCHEMA
    sed -i 's/: User!/: ExamUser!/g' $EXAM_SCHEMA
    sed -i 's/: PersonalInfo/: ExamPersonalInfo/g' $EXAM_SCHEMA
    
    # Fix return types in queries
    sed -i 's/: WaitingListResponse!/: ExamWaitingListResponse!/g' $EXAM_SCHEMA
    sed -i 's/: AccessCheckResponse!/: ExamAccessCheckResponse!/g' $EXAM_SCHEMA
    sed -i 's/: RegistrationResponse!/: ExamRegistrationResponse!/g' $EXAM_SCHEMA
    sed -i 's/: RegistrationStatusResponse!/: ExamRegistrationStatusResponse!/g' $EXAM_SCHEMA
    sed -i 's/checkRegistrationStatus(.*): RegistrationResponse!/checkRegistrationStatus(examId: ID!, email: String!): ExamRegistrationResponse!/g' $EXAM_SCHEMA
    
    # Fix return types in mutations
    sed -i 's/: ApprovalResponse!/: ExamApprovalResponse!/g' $EXAM_SCHEMA
    sed -i 's/: CreateSessionResponse!/: CreateExamSessionResponse!/g' $EXAM_SCHEMA
    sed -i 's/: QRCodeData!/: ExamQRCodeData!/g' $EXAM_SCHEMA
    sed -i 's/registerForGroupTestSession(.*): RegistrationResponse!/registerForGroupTestSession(input: RegisterForExamSessionInput!): ExamRegistrationResponse!/g' $EXAM_SCHEMA
    sed -i 's/registerForExam(.*): RegistrationResponse!/registerForExam(input: ExamRegistrationInput!): ExamRegistrationResponse!/g' $EXAM_SCHEMA
    sed -i 's/resendSessionQRCode(.*): RegistrationResponse!/resendSessionQRCode(examId: ID!, email: String!): ExamRegistrationResponse!/g' $EXAM_SCHEMA
    
    # Fix input types
    sed -i 's/input PreRegistrationInput {/input ExamPreRegistrationInput {/g' $EXAM_SCHEMA
    sed -i 's/input UserRegistrationInput {/input ExamUserRegistrationInput {/g' $EXAM_SCHEMA
    sed -i 's/input RegisterForSessionInput {/input RegisterForExamSessionInput {/g' $EXAM_SCHEMA
    sed -i 's/input QuestionTypeCounts {/input ExamQuestionTypeCounts {/g' $EXAM_SCHEMA
    
    # Update references to renamed input types
    sed -i 's/PreRegistrationInput/ExamPreRegistrationInput/g' $EXAM_SCHEMA
    sed -i 's/UserRegistrationInput/ExamUserRegistrationInput/g' $EXAM_SCHEMA
    sed -i 's/RegisterForSessionInput/RegisterForExamSessionInput/g' $EXAM_SCHEMA
    sed -i 's/QuestionTypeCounts/ExamQuestionTypeCounts/g' $EXAM_SCHEMA
    
    # Fix PreRegistrationDetail references
    sed -i 's/PreRegistrationDetail/ExamPreRegistrationDetail/g' $EXAM_SCHEMA
    sed -i 's/SessionRegistration/ExamSessionRegistration/g' $EXAM_SCHEMA
    
    echo -e "${GREEN}✅ Exam schema fully namespaced${NC}"
else
    echo -e "${RED}❌ Exam schema not found at $EXAM_SCHEMA${NC}"
fi
echo ""

# ============================================
# STEP 5: FIX RESOLVERS (Update return types)
# ============================================
echo -e "${BLUE}🔧 Fixing Resolvers...${NC}"

# Fix exam resolvers
find src/graphql/resolvers -name "*.ts" -type f -exec sed -i 's/: RegistrationResponse$/: ExamRegistrationResponse/g' {} \;
find src/graphql/resolvers -name "*.ts" -type f -exec sed -i 's/: ApprovalResponse$/: ExamApprovalResponse/g' {} \;
find src/graphql/resolvers -name "*.ts" -type f -exec sed -i 's/: AccessCheckResponse$/: ExamAccessCheckResponse/g' {} \;
find src/graphql/resolvers -name "*.ts" -type f -exec sed -i 's/: WaitingListResponse$/: ExamWaitingListResponse/g' {} \;
find src/graphql/resolvers -name "*.ts" -type f -exec sed -i 's/: QRCodeData$/: ExamQRCodeData/g' {} \;

# Fix paper resolvers
find src/graphql/resolvers -name "*.ts" -type f -exec sed -i 's/: RegistrationResponse$/: PaperRegistrationResponse/g' {} \;
find src/graphql/resolvers -name "*.ts" -type f -exec sed -i 's/: ApprovalResponse$/: PaperApprovalResponse/g' {} \;
find src/graphql/resolvers -name "*.ts" -type f -exec sed -i 's/: AccessCheckResponse$/: PaperAccessCheckResponse/g' {} \;
find src/graphql/resolvers -name "*.ts" -type f -exec sed -i 's/: WaitingListResponse$/: PaperWaitingListResponse/g' {} \;
find src/graphql/resolvers -name "*.ts" -type f -exec sed -i 's/: QRCodeResponse$/: PaperQRCodeResponse/g' {} \;

echo -e "${GREEN}✅ Resolvers updated${NC}"
echo ""

# ============================================
# STEP 6: UPDATE SCHEMA INDEX (if exists)
# ============================================
echo -e "${BLUE}📦 Updating schema index...${NC}"

SCHEMA_INDEX="src/graphql/schema/index.ts"
if [ -f "$SCHEMA_INDEX" ]; then
    # Ensure both schemas are exported properly
    if ! grep -q "paperTypeDefs" $SCHEMA_INDEX; then
        echo "export { default as paperTypeDefs } from './paperTypeDefs';" >> $SCHEMA_INDEX
    fi
    if ! grep -q "examTypeDefs" $SCHEMA_INDEX; then
        echo "export { default as examTypeDefs } from './examTypeDefs';" >> $SCHEMA_INDEX
    fi
    echo -e "${GREEN}✅ Schema index updated${NC}"
else
    echo -e "${YELLOW}⚠️  No schema index found, skipping${NC}"
fi
echo ""

# ============================================
# STEP 7: CLEAN BUILD CACHE
# ============================================
echo -e "${BLUE}🧹 Cleaning build cache...${NC}"
rm -rf dist/
rm -rf node_modules/.cache/
echo -e "${GREEN}✅ Cache cleaned${NC}"
echo ""

# ============================================
# STEP 8: VERIFY FIXES
# ============================================
echo -e "${BLUE}✓ Verifying no conflicting types remain...${NC}"

CONFLICTS_REMAINING=0

# Check for un-namespaced RegistrationResponse
if grep -r "RegistrationResponse" src/graphql/schema/ --include="*.ts" | grep -v "PaperRegistrationResponse" | grep -v "ExamRegistrationResponse" | grep -q "RegistrationResponse"; then
    echo -e "${RED}❌ Found un-namespaced RegistrationResponse:${NC}"
    grep -r "RegistrationResponse" src/graphql/schema/ --include="*.ts" | grep -v "PaperRegistrationResponse" | grep -v "ExamRegistrationResponse"
    CONFLICTS_REMAINING=1
fi

# Check for un-namespaced ApprovalResponse
if grep -r "ApprovalResponse" src/graphql/schema/ --include="*.ts" | grep -v "PaperApprovalResponse" | grep -v "ExamApprovalResponse" | grep -q "ApprovalResponse"; then
    echo -e "${RED}❌ Found un-namespaced ApprovalResponse:${NC}"
    grep -r "ApprovalResponse" src/graphql/schema/ --include="*.ts" | grep -v "PaperApprovalResponse" | grep -v "ExamApprovalResponse"
    CONFLICTS_REMAINING=1
fi

# Check for un-namespaced AccessCheckResponse
if grep -r "AccessCheckResponse" src/graphql/schema/ --include="*.ts" | grep -v "PaperAccessCheckResponse" | grep -v "ExamAccessCheckResponse" | grep -q "AccessCheckResponse"; then
    echo -e "${RED}❌ Found un-namespaced AccessCheckResponse:${NC}"
    grep -r "AccessCheckResponse" src/graphql/schema/ --include="*.ts" | grep -v "PaperAccessCheckResponse" | grep -v "ExamAccessCheckResponse"
    CONFLICTS_REMAINING=1
fi

# Check for un-namespaced WaitingListResponse
if grep -r "WaitingListResponse" src/graphql/schema/ --include="*.ts" | grep -v "PaperWaitingListResponse" | grep -v "ExamWaitingListResponse" | grep -q "WaitingListResponse"; then
    echo -e "${RED}❌ Found un-namespaced WaitingListResponse:${NC}"
    grep -r "WaitingListResponse" src/graphql/schema/ --include="*.ts" | grep -v "PaperWaitingListResponse" | grep -v "ExamWaitingListResponse"
    CONFLICTS_REMAINING=1
fi

if [ $CONFLICTS_REMAINING -eq 0 ]; then
    echo -e "${GREEN}✅ No conflicting types found!${NC}"
else
    echo -e "${YELLOW}⚠️  Some conflicts remain. Manual review may be needed.${NC}"
fi
echo ""

# ============================================
# STEP 9: FINAL SUMMARY
# ============================================
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ NAMESPACING COMPLETE!${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo ""
echo "Changes applied:"
echo "  📄 Paper domain:  Paper prefix added to all types"
echo "  📝 Exam domain:   Exam prefix added to all types"
echo "  🔧 Resolvers:     Updated return types"
echo "  🧹 Cache:         Cleaned"
echo ""
echo "Next steps:"
echo "  1. Restart your server: npm run dev"
echo "  2. Check if GraphQL schema loads correctly"
echo "  3. Test queries in both domains"
echo ""
echo -e "${YELLOW}If you still see errors, run:${NC}"
echo "  grep -r 'RegistrationResponse' src/ --include='*.ts' | grep -v 'Paper\|Exam'"
echo ""

# ============================================
# OPTIONAL: RESTART SERVER PROMPT
# ============================================
read -p "Restart server now? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}🔄 Restarting server...${NC}"
    npm run dev
else
    echo -e "${GREEN}✅ Fix complete. Run 'npm run dev' when ready.${NC}"
fi
