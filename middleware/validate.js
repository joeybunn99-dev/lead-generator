const { z } = require('zod');

function validate(schema) {
    return (req, res, next) => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            return res.status(400).json({
                error: 'Validation failed',
                details: result.error.issues.map(i => ({ field: i.path.join('.'), message: i.message })),
            });
        }
        req.validated = result.data;
        next();
    };
}

const loginSchema = z.object({
    username: z.string().min(1),
    password: z.string().min(1),
});

const pullSchema = z.object({
    industries: z.array(z.string()).min(1),
    radius: z.number().min(10).max(500).default(300),
});

const importSchema = z.array(z.object({
    name: z.string().min(1),
    city: z.string().optional(),
    state: z.string().optional(),
    industry: z.string().optional(),
    website: z.string().optional(),
    phone: z.string().optional(),
}));

const scrapeUrlSchema = z.object({
    url: z.string().url(),
});

module.exports = { validate, loginSchema, pullSchema, importSchema, scrapeUrlSchema };
