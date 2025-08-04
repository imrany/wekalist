export const plans = [
    {
      id: 'basic',
      name: 'Basic',
      price: 299,
      currency: 'KES',
      aiQuota: 600,
      features: [
        '600 AI summaries per month',
        'Basic memo generation',
        'Standard support',
        'Mobile app access'
      ]
    },
    {
      id: 'pro',
      name: 'Pro',
      price: 599,
      currency: 'KES',
      aiQuota: 1500,
      features: [
        '1500 AI summaries per month',
        'Advanced memo generation',
        'Priority support',
        'Custom tags & categories',
        'Including features from Basic plan'
      ],
      popular: true
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 1299,
      currency: 'KES',
      aiQuota: 3000,
      features: [
        '3000 AI summaries per month',
        'Advanced memo generation',
        'API access',
        'Dedicated support',
        'Including features from Pro plan'
      ]
    }
];
