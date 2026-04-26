// --- 2. BRANDING CONSTANTS ---
const BRAND = {
  name: "PHEOCConnect",
  primaryColor: "#007bff",
  secondaryColor: "#6c757d",
  accentColor: "#28a745",
  lightColor: "#f8f9fa",
  darkColor: "#343a40",
  logoFilename: "pheocconnect v1.0.png",
  website: "https://pheocconnect.org",
  supportEmail: "info@pheocconnect.org",
  phone: "+254 (700) 378-241",
  address: "Busia County Referral Hospital , Busia County EOC, Busia KE 50400",
};

const SOCIAL_LINKS = [
  {
    name: "Facebook",
    url: "https://facebook.com/pheocconnect",
    icon: "https://cdn-icons-png.flaticon.com/32/733/733547.png",
  },
  {
    name: "X",
    url: "https://x.com/pheocconnect",
    icon: "https://cdn-icons-png.flaticon.com/512/5968/5968830.png",
  },
  {
    name: "Instagram",
    url: "https://instagram.com/pheocconnect",
    icon: "https://cdn-icons-png.flaticon.com/32/2111/2111463.png",
  },
  {
    name: "LinkedIn",
    url: "https://linkedin.com/company/pheocconnect",
    icon: "https://cdn-icons-png.flaticon.com/32/3536/3536505.png",
  },
];

const socialIconsHtml = SOCIAL_LINKS.map(
  (link) =>
    `<a href="${link.url}" style="margin:0 6px"><img src="${link.icon}" alt="${link.name}" width="20" height="20" style="display:inline-block;border:0"></a>`,
).join("");

// --- COMPACT MODERN FOOTER ---
export const emailFooter = `
  <div style="background:#fafbfc; color:#5a6a7a; padding:20px 16px; text-align:center; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; font-size:12px; border-top:1px solid #eaeef2">
    <div style="margin-bottom:10px">${socialIconsHtml}</div>
    <div style="font-weight:600; font-size:13px; color:#2c3e50; margin-bottom:6px">${BRAND.name}</div>
    <div style="margin-bottom:8px; line-height:1.4">
      ${BRAND.address}<br>
      <a href="mailto:${BRAND.supportEmail}" style="color:#3b82f6; text-decoration:none">${BRAND.supportEmail}</a> · ${BRAND.phone}
    </div>
    <div style="font-size:11px; color:#7a8a9a">
      © ${new Date().getFullYear()} ${BRAND.name} · 
      <a href="${BRAND.website}" style="color:#3b82f6; text-decoration:none">Website</a> · 
      <a href="{{unsubscribe_url}}" style="color:#3b82f6; text-decoration:none">Unsubscribe</a>
    </div>
  </div>
`;
