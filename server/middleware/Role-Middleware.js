/**
 * Role-Based Access Control Middleware Generator
 * Array of roles allowed to access the route
 */
const roleMiddleware = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.role || !allowedRoles.includes(req.role)) {
            return res.status(403).json({
                success: false,
                message: "Forbidden. Unauthorized role access.",
                error: "UNAUTHORIZED_ROLE"
            });
        }
        next();
    };
};

module.exports = {
    roleMiddleware
};
