import { useState } from 'react';
import { Check, Star } from 'lucide-react';
import { plans } from '@/utils/plans';
import { useNavigate } from 'react-router-dom';
import useResponsiveWidth from '@/hooks/useResponsiveWidth';
import MobileHeader from '@/components/MobileHeader';

const Upgrade = () => {
  const navigate = useNavigate()
  const [selectedPlan, setSelectedPlan] = useState('pro');
  const { md } = useResponsiveWidth();
  
  return (
    <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
        {!md && <MobileHeader />}
        <div className="w-full px-4 sm:px-6 max-sm:pt-3">
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="text-center mb-12">
            <h1 className="md:text-4xl text-2xl text-primary font-bold mb-4">
                Upgrade Your Memos Experience
            </h1>
            <p className="md:text-xl text-foreground max-w-2xl mx-auto">
                Unlock powerful AI features and get more out of your memo management
            </p>
            </div>

            {/* Plans */}
            <div className="grid md:grid-cols-3 gap-8 mb-12">
            {plans.map((plan) => (
                <div
                key={plan.id}
                className={`relative rounded-2xl p-8 transition-all duration-300 cursor-pointer ${
                    selectedPlan === plan.id
                    ? 'border ring-4 ring-primary scale-105'
                    : 'border hover:shadow-xl hover:scale-102'
                }`}
                onClick={() =>{
                    setSelectedPlan(plan.id)
                    navigate(`/checkout/${plan.id}`)
                }}
                >
                {plan.popular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="shadow-lg bg-primary text-background px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-1">
                        <Star className="w-4 h-4" />
                        Most Popular
                    </span>
                    </div>
                )}
                
                <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold text-primary mb-2">{plan.name}</h3>
                    <div className="flex items-center justify-center gap-1 mb-4">
                    <span className="text-4xl font-bold text-foreground">{plan.currency} {plan.price.toLocaleString()}</span>
                    <span className="text-foreground">/month</span>
                    </div>
                    <p className="text-foreground font-semibold">{plan.aiQuota} AI summaries included</p>
                </div>

                <ul className="space-y-3 mb-6">
                    {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-3">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                        <span className="text-foreground">{feature}</span>
                    </li>
                    ))}
                </ul>

                <div className={`w-6 h-6 rounded-full border-2 mx-auto ${
                    selectedPlan === plan.id 
                    ? 'bg-card-foreground border-foreground' 
                    : 'border-gray-300'
                }`}>
                    {selectedPlan === plan.id && (
                    <Check className="w-4 h-4 text-background m-0.5" />
                    )}
                </div>
                </div>
            ))}
            </div>
        </div>
        </div>
    </section>
  );
};

export default Upgrade;