import React from 'react';
import { Link } from 'react-router-dom';
import { 
  FaDollarSign, 
  FaClock, 
  FaGraduationCap, 
  FaMapMarkerAlt,
  FaArrowRight,
  FaTools,
  FaBolt,
  FaZap
} from 'react-icons/fa';

const CareerSection = () => {
  const benefits = [
    {
      icon: <FaDollarSign className="text-2xl" />,
      title: "Earn Good Income",
      description: "Competitive rates with timely payments and performance bonuses for quality work."
    },
    {
      icon: <FaClock className="text-2xl" />,
      title: "Flexible Hours",
      description: "Choose your own schedule and work-life balance. Accept jobs that fit your availability."
    },
    {
      icon: <FaGraduationCap className="text-2xl" />,
      title: "Training & Support",
      description: "Continuous skill development programs and 24/7 technical support for all providers."
    },
    {
      icon: <FaMapMarkerAlt className="text-2xl" />,
      title: "Work Locally",
      description: "Get matched with customers in your area. Reduce travel time and serve your community."
    }
  ];

  return (
    <section className="bg-background py-16 lg:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          
          {/* Text Content */}
          <div className="order-2 lg:order-1">

            <div className="inline-flex items-center bg-primary/10 px-6 py-3 rounded-full border border-primary/20 mb-6">
              <FaZap className="w-5 h-5 text-primary mr-2" />
              <span className="text-primary font-medium">Career</span>
            </div>

            {/* Headline */}
            <div className="mb-8">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-primary mb-4 leading-tight">
                Join Our Network of 
                <span className="block text-primary">Electrical Service Providers</span>
              </h2>
              
              <p className="text-lg text-secondary leading-relaxed max-w-xl">
                Build a rewarding career with steady jobs, flexible scheduling, and timely payments. 
                Join our growing network of certified electrical professionals and unlock new growth opportunities 
                in your local community.
              </p>
            </div>

            {/* Benefits Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
              {benefits.map((benefit, index) => (
                <div
                  key={index}
                  className="bg-white p-6 rounded-xl shadow-md border border-gray-100 hover:shadow-lg transition-all duration-300 group cursor-pointer"
                >
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
                      {benefit.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-secondary mb-2 group-hover:text-primary transition-colors duration-300">
                        {benefit.title}
                      </h3>
                      <p className="text-sm text-secondary/80 leading-relaxed">
                        {benefit.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Call to Action Button */}
            <div>
              <Link 
                to="/provider-register"
                className="group inline-flex items-center px-8 py-4 bg-accent text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 hover:bg-accent/90"
              >
                <span className="mr-3">Join Today</span>
                <FaArrowRight className="text-sm group-hover:translate-x-1 transition-transform duration-300" />
              </Link>
              
              <p className="text-sm text-secondary/70 mt-3">
                Start your application in less than 5 minutes
              </p>
            </div>
          </div>

          {/* Image/Illustration Placeholder */}
          <div className="order-1 lg:order-2">
            <div className="relative">
              {/* Main Image Placeholder */}
              <div className="bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl p-8 lg:p-12 shadow-xl">
                <div className="bg-white rounded-xl p-8 shadow-lg">
                  {/* Electrician Illustration Placeholder */}
                  <div className="flex flex-col items-center justify-center space-y-6">
                    <div className="relative">
                      <div className="w-32 h-32 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center shadow-lg">
                        <FaTools className="text-4xl text-white" />
                      </div>
                      <div className="absolute -top-2 -right-2 w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                        <FaBolt className="text-white text-sm" />
                      </div>
                    </div>
                    
                    <div className="text-center">
                      <h3 className="text-xl font-bold text-primary mb-2">Professional Electrician</h3>
                      <p className="text-secondary/70 text-sm">Certified & Trusted Service Provider</p>
                    </div>
                    
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-4 w-full">
                      <div className="text-center p-3 bg-primary/5 rounded-lg">
                        <div className="text-lg font-bold text-primary">500+</div>
                        <div className="text-xs text-secondary/70">Jobs Completed</div>
                      </div>
                      <div className="text-center p-3 bg-accent/5 rounded-lg">
                        <div className="text-lg font-bold text-accent">4.9★</div>
                        <div className="text-xs text-secondary/70">Rating</div>
                      </div>
                      <div className="text-center p-3 bg-primary/5 rounded-lg">
                        <div className="text-lg font-bold text-primary">24/7</div>
                        <div className="text-xs text-secondary/70">Available</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Floating Elements */}
              <div className="absolute -top-4 -left-4 w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center backdrop-blur-sm animate-pulse">
                <FaBolt className="text-accent text-xl" />
              </div>
              
              <div className="absolute -bottom-4 -right-4 w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center backdrop-blur-sm animate-pulse">
                <FaTools className="text-primary text-sm" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CareerSection;
