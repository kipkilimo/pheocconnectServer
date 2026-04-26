import { mergeResolvers } from "@graphql-tools/merge";

import userResolver from "./user.resolver";
import organizationResolver from "./organization.resolver";
import eocResolver from "./eoc.resolver";
import { surveillanceResolvers } from "./surveillance.resolver";
import labResolver from "./lab.resolver";
import incidentResolver from "./incident.resolver";
import sitrepResolver from "./sitrep.resolver";
import responseResolver from "./response.resolver";
import resourceResolver from "./resource.resolver";
import dashboardResolver from "./dashboard.resolver";

export const resolvers = mergeResolvers([
  userResolver,
  organizationResolver,
  eocResolver,
  surveillanceResolvers,
  labResolver,
  incidentResolver,
  sitrepResolver,
  responseResolver,
  resourceResolver,
  dashboardResolver,
]);

export default resolvers;
