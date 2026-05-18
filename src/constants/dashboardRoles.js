const DASHBOARD_ROLES = Object.freeze(["superadmin", "admin", "kitchen", "courier", "cashier"]);

const DASHBOARD_ROLE_LABEL = DASHBOARD_ROLES.join(", ");

module.exports = {
  DASHBOARD_ROLES,
  DASHBOARD_ROLE_LABEL,
};
