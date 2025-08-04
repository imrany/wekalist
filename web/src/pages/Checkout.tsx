import MobileHeader from "@/components/MobileHeader";
import useResponsiveWidth from "@/hooks/useResponsiveWidth";
import { plans } from "@/utils/plans";
import { CreditCard, Loader2, Smartphone } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";

const Checkout = () => {
    const [paymentMethod, setPaymentMethod] = useState('mpesa');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [email, setEmail] = useState('');
    const [firstName, setFirstName] = useState('');
    const { selectedPlan }=useParams()
    const [lastName, setLastName] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const { md } = useResponsiveWidth();
    

    const paymentMethods = [
        {
            id: 'mpesa',
            name: 'M-Pesa',
            icon: Smartphone,
            description: 'Pay with your mobile money'
        },
        {
            id: 'card',
            name: 'Card Payment',
            icon: CreditCard,
            description: 'Visa, Mastercard accepted'
        }
    ];

    const handlePayment = async () => {
        if (!phoneNumber || !email || !firstName || !lastName) {
            alert('Please fill in all required fields');
            return;
        }

        setIsProcessing(true);

        try {
            const selectedPlanData = plans.find(p => p.id === selectedPlan);

            if (paymentMethod === 'mpesa') {
                // M-Pesa STK Push simulation
                const response = await fetch('/api/mpesa/stkpush', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        phoneNumber: phoneNumber.replace(/^0/, '254'), // Convert to international format
                        amount: selectedPlanData?.price,
                        accountReference: `MEMO-${selectedPlan?.toUpperCase()}`,
                        transactionDesc: `Memos ${selectedPlanData?.name} Plan Subscription`,
                        userDetails: {
                            firstName,
                            lastName,
                            email
                        }
                    })
                });

                const result = await response.json();

                if (result.success) {
                    alert(`M-Pesa payment request sent to ${phoneNumber}. Please check your phone and enter your M-Pesa PIN to complete the payment.`);
                } else {
                    throw new Error(result.message || 'Payment failed');
                }
            } else {
                // Card payment - integrate with Stripe or other card processor
                alert('Card payment integration would go here');
            }
        } catch (error: any) {
            alert(`Payment failed: ${error.message}`);
        } finally {
            setIsProcessing(false);
        }
    };

    const formatPhoneNumber = (value: string) => {
        // Remove non-digits
        const cleaned = value.replace(/\D/g, '');

        // Format as Kenyan number
        if (cleaned.startsWith('254')) {
            return cleaned.slice(0, 12);
        } else if (cleaned.startsWith('0')) {
            return cleaned.slice(0, 10);
        } else if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
            return '0' + cleaned.slice(0, 9);
        }
        return cleaned.slice(0, 10);
    };
    return (
        <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
            {!md && <MobileHeader />}
            <div className="px-4 sm:px-6 max-sm:pt-3">
                <h2 className="text-2xl font-bold text-primary mb-6">Complete Your Upgrade</h2>

                {/* User Details */}
                <div className="grid md:grid-cols-2 gap-4 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                            First Name *
                        </label>
                        <input
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            placeholder="Enter your first name"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                            Last Name *
                        </label>
                        <input
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            placeholder="Enter your last name"
                        />
                    </div>
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-foregrounf mb-2">
                        Email Address *
                    </label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                        placeholder="Enter your email address"
                    />
                </div>

                {/* Payment Method Selection */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-foreground mb-4">
                        Payment Method
                    </label>
                    <div className="grid md:grid-cols-2 gap-4">
                        {paymentMethods.map((method) => (
                            <div
                                key={method.id}
                                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${paymentMethod === method.id
                                    ? 'border-primary'
                                    : 'border'
                                    }`}
                                onClick={() => setPaymentMethod(method.id)}
                            >
                                <div className="flex items-center gap-3">
                                    <method.icon className={`w-6 h-6 ${paymentMethod === method.id ? 'text-primary' : 'text-secondary'
                                        }`} />
                                    <div>
                                        <h4 className="font-semibold text-primary">{method.name}</h4>
                                        <p className="text-sm text-foreground">{method.description}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Phone Number for M-Pesa */}
                {paymentMethod === 'mpesa' && (
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-foreground mb-2">
                            M-Pesa Phone Number *
                        </label>
                        <input
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))}
                            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                            placeholder="0712345678"
                            maxLength={10}
                        />
                        <p className="text-sm text-foreground mt-1">
                            Enter your Safaricom number (starts with 07...)
                        </p>
                    </div>
                )}

                {/* Order Summary */}
                <div className="border rounded-lg p-6 mb-6">
                    <h3 className="font-semibold text-primary mb-4">Order Summary</h3>
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-foreground">
                            {plans.find(p => p.id === selectedPlan)?.name} Plan
                        </span>
                        <span className="font-semibold">
                            KES {plans.find(p => p.id === selectedPlan)?.price.toLocaleString()}
                        </span>
                    </div>
                    <div className="flex justify-between items-center text-lg font-bold border-t pt-2">
                        <span>Total</span>
                        <span>KES {plans.find(p => p.id === selectedPlan)?.price.toLocaleString()}</span>
                    </div>
                </div>

                {/* Payment Button */}
                <button
                    onClick={handlePayment}
                    disabled={isProcessing}
                    className="w-full bg-primary text-background py-4 px-6 rounded-lg font-semibold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isProcessing ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Processing Payment...
                        </>
                    ) : (
                        <>
                            {paymentMethod === 'mpesa' ? (
                                <>
                                    <Smartphone className="w-5 h-5" />
                                    Pay with M-Pesa
                                </>
                            ) : (
                                <>
                                    <CreditCard className="w-5 h-5" />
                                    Pay with Card
                                </>
                            )}
                        </>
                    )}
                </button>

                <p className="text-center text-sm text-foreground mt-4">
                    Secure payment powered by industry-standard encryption
                </p>
            </div>
        </section>
    )
}
export default Checkout;