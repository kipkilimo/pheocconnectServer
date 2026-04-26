import { defaultFieldResolver, GraphQLFieldConfig } from "graphql";
import { mapSchema, getDirective, MapperKind } from "@graphql-tools/utils";

export const authDirectiveTransformer = (schema: any) => {
  return mapSchema(schema, {
    [MapperKind.OBJECT_FIELD]: (fieldConfig: GraphQLFieldConfig<any, any>) => {
      const authDirective = getDirective(schema, fieldConfig, "auth")?.[0];

      if (!authDirective) return fieldConfig;

      const { requires } = authDirective;

      const originalResolver = fieldConfig.resolve || defaultFieldResolver;

      fieldConfig.resolve = async (source, args, context, info) => {
        // Get user from context
        const user = context.user;

        // Debug logging
        console.log(`[Auth Directive] Field: ${info.fieldName}`);
        console.log(
          `[Auth Directive] User:`,
          user
            ? {
                id: user.id,
                email: user.email,
                role: user.role,
              }
            : "No user",
        );

        // Check if user exists
        if (!user) {
          console.error(
            `[Auth Directive] Not authenticated - no user in context`,
          );
          throw new Error("Not authenticated");
        }

        // Check if role is required
        if (requires) {
          // Handle requires as string or array
          const requiredRoles = Array.isArray(requires) ? requires : [requires];

          if (!requiredRoles.includes(user.role)) {
            console.error(
              `[Auth Directive] Not authorized - user role: ${user.role}, required: ${requiredRoles.join(", ")}`,
            );
            throw new Error("Not authorized");
          }
        }

        // User is authenticated and authorized
        return originalResolver(source, args, context, info);
      };

      return fieldConfig;
    },
  });
};
