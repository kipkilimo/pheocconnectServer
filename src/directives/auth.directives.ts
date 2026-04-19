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
        const user = context.user;

        if (!user) {
          throw new Error("Not authenticated");
        }

        if (requires && !requires.includes(user.role)) {
          throw new Error("Not authorized");
        }

        return originalResolver(source, args, context, info);
      };

      return fieldConfig;
    },
  });
};
