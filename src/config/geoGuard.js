import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

export default function getGeoGuardConfig(ENV) {
  const raw = ENV.STATE_RESTRICTION_ARRAY;
  const blockedRegions = raw ? JSON.parse(raw) : [];

  const rawCountries = ENV.COUNTRY_RESTRICTION_ARRAY;
  const blockedCountries = rawCountries ? JSON.parse(rawCountries) : [];

  const rawRoleCountries = ENV.ROLE_REGION_COUNTRY;
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