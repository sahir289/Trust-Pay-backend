export default function getGeoGuardConfig() {
  const raw = process.env.STATE_RESTRICTION_ARRAY;
  const blockedRegions = raw ? JSON.parse(raw) : [];

  const rawCountries = process.env.COUNTRY_RESTRICTION_ARRAY;
  const blockedCountries = rawCountries ? JSON.parse(rawCountries) : [];

  const rawRoleCountries = process.env.ROLE_REGION_COUNTRY;
  const roleRegionCountries = rawRoleCountries ? JSON.parse(rawRoleCountries) : [];

  return {
    maxAccuracy: 100,
    restrictVpnForRoles: ['VENDOR'],
    blockedCountries,
    roleRegionRules: {
      VENDOR: {
        countries: roleRegionCountries,
        blockedRegions,
      },
    },
  };
}