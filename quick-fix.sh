#!/bin/bash

echo "🎯 Targeting getWaitingList conflict..."

# Fix paper schema - add Paper prefix to WaitingListResponse
sed -i 's/type WaitingListResponse {/type PaperWaitingListResponse {/g' src/graphql/schema/paperTypeDefs.ts
sed -i 's/: WaitingListResponse!/: PaperWaitingListResponse!/g' src/graphql/schema/paperTypeDefs.ts

# Fix exam schema - ensure Exam prefix is consistent
sed -i 's/type WaitingListResponse {/type ExamWaitingListResponse {/g' src/graphql/schema/examTypeDefs.ts
sed -i 's/: WaitingListResponse!/: ExamWaitingListResponse!/g' src/graphql/schema/examTypeDefs.ts

# Also fix other conflicting types
sed -i 's/type AccessCheckResponse {/type PaperAccessCheckResponse {/g' src/graphql/schema/paperTypeDefs.ts
sed -i 's/: AccessCheckResponse!/: PaperAccessCheckResponse!/g' src/graphql/schema/paperTypeDefs.ts

sed -i 's/type RegistrationResponse {/type PaperRegistrationResponse {/g' src/graphql/schema/paperTypeDefs.ts
sed -i 's/: RegistrationResponse!/: PaperRegistrationResponse!/g' src/graphql/schema/paperTypeDefs.ts

sed -i 's/type ApprovalResponse {/type PaperApprovalResponse {/g' src/graphql/schema/paperTypeDefs.ts
sed -i 's/: ApprovalResponse!/: PaperApprovalResponse!/g' src/graphql/schema/paperTypeDefs.ts

echo "✅ Fix applied!"
echo "🔄 Restart your server now"
