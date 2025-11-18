export default {
    maxAccuracy: 100,
    restrictVpnForRoles: ['VENDOR'],
    blockedCountries: [],
    roleRegionRules: {
      VENDOR: {
        country: 'India',
        blockedRegions: ['Gujarat', 'Goa'],
      },
    },
  };