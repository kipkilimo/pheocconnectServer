import { fuzzy } from "fast-fuzzy";
import { publicationCreditCharges } from "../../../utils/publicationCredits";
import {
  PublicationCreditCharge,
  PublicationCreditKey,
  StrictPublicationCreditCharge,
} from "../../../types/creditCharge";
export function getCreditsForType(
  resourceType: string,
  publicationCreditCharges: PublicationCreditCharge[],
): number {
  const matchingCharge = publicationCreditCharges.find(
    (charge) => charge.key === resourceType,
  );
  return matchingCharge ? matchingCharge.credits : 0;
}

export function getCreditsByResourceType(resourceType: string): number {
  return getCreditsForType(resourceType, publicationCreditCharges);
}

export function createFuzzyMatcher(searchQuery: string) {
  return (str: string) => fuzzy(searchQuery, str);
}

export function calculateResourceScore(
  resource: any,
  sanitizedQuery: string,
  fuzzyMatch: (str: string) => number,
): number {
  const searchContent = [
    resource.title,
    resource.subject,
    resource.topic,
    resource.description,
    ...(resource.keywords || []),
  ]
    .filter(Boolean)
    .join(" ");

  return fuzzyMatch(searchContent);
}

export function isValidObjectId(id: string): boolean {
  return /^[0-9a-fA-F]{24}$/.test(id);
}

export function parseJsonParams<T>(params: string, defaultValue?: T): T {
  try {
    const parsed = JSON.parse(params);
    return defaultValue && Array.isArray(parsed) ? parsed[0] : parsed;
  } catch (error) {
    console.error("Error parsing JSON params:", error);
    return defaultValue as T;
  }
}

export function checkActiveSubscription(user: any): boolean {
  const sub = user.subscriptionDetails;
  if (!sub?.status) return false;

  const isPaidStatus = ["BASIC", "STANDARD", "PREMIUM"].includes(sub.status);
  if (!isPaidStatus) return false;

  return !sub.expiry || new Date(sub.expiry) > new Date();
}
export function formatPublicationTrends(publicationTrends: any[]): any[] {
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  return publicationTrends
    .map((item: { _id: { month: number; year: any }; count: any }) => {
      const monthIndex = item._id.month ? item._id.month - 1 : -1;
      const year = String(item._id.year).slice(-2);
      if (monthIndex >= 0 && monthIndex < monthNames.length) {
        const month = monthNames[monthIndex];
        return { period: `${month} '${year}`, count: item.count };
      }
      return null;
    })
    .filter((item): item is { period: string; count: any } => item !== null);
}
