import React from 'react';
import { FaBolt, FaTwitter, FaLinkedin, FaMapMarkerAlt, FaUsers, FaBullseye, FaHistory } from 'react-icons/fa';

const AboutPage = () => {

  return (
    <div className="bg-blue-50">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-r from-blue-900 to-indigo-900 text-white py-20 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-64 h-64 bg-yellow-400 rounded-full filter blur-[100px]"></div>
          <div className="absolute bottom-0 right-0 w-72 h-72 bg-yellow-500 rounded-full filter blur-[120px]"></div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div
            className="text-center"
          >
            <div className="inline-flex items-center bg-white/10 backdrop-blur-sm px-6 py-3 rounded-full border border-blue-700 mb-6">
              <FaBolt className="text-yellow-400 mr-2" />
              <span className="font-medium">Our Journey</span>
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              Powering Excellence <span className="text-yellow-400">Since 2002</span>
            </h1>
            <p className="text-xl text-blue-200 max-w-3xl mx-auto">
              Delivering reliable electrical solutions with certified expertise and cutting-edge technology.
            </p>
          </div>
        </div>
      </section>

      {/* Our Story Section */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
        >
          <div>
            <div className="flex items-center mb-6">
              <div className="p-3 rounded-lg bg-yellow-400 text-blue-900 mr-4">
                <FaHistory className="text-2xl" />
              </div>
              <h2 className="text-3xl font-bold text-blue-900">Our Story</h2>
            </div>
            <p className="text-gray-600 mb-6">
              What began as a modest electrical repair service has flourished into a trusted name in the industry. Founded on principles of integrity and quality, we've grown through dedication to customer satisfaction and technical excellence.
            </p>
            <p className="text-gray-600 mb-8">
              Today, our team of certified professionals serves both residential and commercial clients, delivering solutions that power homes, businesses, and communities with reliability and innovation.
            </p>
            <div className="bg-blue-100 border-l-4 border-yellow-400 p-4">
              <p className="italic text-blue-900">
                "Quality isn't just a standard - it's our electrical current that powers every project."
              </p>
            </div>
          </div>
          
          <div 
            className="relative rounded-xl overflow-hidden shadow-2xl border-4 border-white"
          >
            <img 
              src="https://images.unsplash.com/photo-1605152276897-4f618f831968?ixlib=rb-1.2.1&auto=format&fit=crop&w=1000&q=80" 
              alt="Electrical work in progress"
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-blue-900/90 to-transparent p-6">
              <p className="text-white font-medium">Precision electrical installations</p>
            </div>
          </div>
        </div>
      </section>

      {/* Service Area Section */}
      <section className="py-20 bg-blue-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="text-center mb-16"
          >
            <div className="inline-flex items-center bg-white/10 backdrop-blur-sm px-6 py-3 rounded-full border border-blue-700 mb-6">
              <FaMapMarkerAlt className="text-yellow-400 mr-2" />
              <span className="font-medium">Our Services</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">What We Offer</h2>
            <p className="text-blue-200 max-w-3xl mx-auto">
              Comprehensive electrical solutions tailored to your specific needs
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {
                title: "Residential Services",
                areas: ["Complete home wiring", "Lighting solutions", "Safety inspections", "Panel upgrades"],
                icon: <FaBolt className="text-yellow-400 text-3xl" />
              },
              {
                title: "Commercial Services",
                areas: ["Office electrical systems", "Retail space lighting", "Industrial wiring", "Energy audits"],
                icon: <FaBolt className="text-yellow-400 text-3xl" />
              }
            ].map((item, index) => (
              <div
                key={index}
                className="bg-blue-800 rounded-xl p-8 shadow-lg"
              >
                <div className="flex items-center mb-6">
                  <div className="mr-4">
                    {item.icon}
                  </div>
                  <h3 className="text-xl font-bold text-yellow-400">{item.title}</h3>
                </div>
                <ul className="space-y-3">
                  {item.areas.map((area, i) => (
                    <li key={i} className="flex items-center text-blue-100">
                      <span className="w-2 h-2 bg-yellow-400 rounded-full mr-3"></span>
                      {area}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mission/Vision Section */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className="text-center mb-16"
        >
          <div className="inline-flex items-center bg-blue-100 px-6 py-3 rounded-full border border-blue-200 mb-6">
            <FaBullseye className="text-yellow-500 mr-2" />
            <span className="font-medium text-blue-900">Mission & Vision</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-blue-900 mb-4">Our Core Principles</h2>
          <p className="text-gray-600 max-w-3xl mx-auto">
            The foundation that guides our work and aspirations
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div
            className="bg-white rounded-xl shadow-xl overflow-hidden border border-blue-100"
          >
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
              <h3 className="text-2xl font-bold flex items-center">
                <FaBolt className="text-yellow-400 mr-3" />
                Our Mission
              </h3>
            </div>
            <div className="p-8">
              <p className="text-gray-600 mb-6">
                To deliver exceptional electrical services through technical expertise, innovative solutions, and unwavering commitment to safety and quality.
              </p>
              <ul className="space-y-4">
                {[
                  "Reliable, code-compliant electrical work",
                  "Customer safety as top priority",
                  "Premium materials and equipment",
                  "Transparent pricing and honest service"
                ].map((item, index) => (
                  <li key={index} className="flex items-start">
                    <span className="bg-yellow-400 text-blue-900 rounded-full p-1 mr-3 mt-1">
                      <FaBolt className="text-xs" />
                    </span>
                    <span className="text-gray-600">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div
            className="bg-white rounded-xl shadow-xl overflow-hidden border border-blue-100"
          >
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 p-6 text-white">
              <h3 className="text-2xl font-bold flex items-center">
                <FaBolt className="text-yellow-400 mr-3" />
                Our Vision
              </h3>
            </div>
            <div className="p-8">
              <p className="text-gray-600 mb-6">
                To set industry standards for excellence in electrical services through innovation, skilled craftsmanship, and unparalleled customer satisfaction.
              </p>
              <ul className="space-y-4">
                {[
                  "Continuous improvement in service quality",
                  "Investment in team training and development",
                  "Adoption of emerging electrical technologies",
                  "Sustainable and efficient energy solutions"
                ].map((item, index) => (
                  <li key={index} className="flex items-start">
                    <span className="bg-yellow-400 text-blue-900 rounded-full p-1 mr-3 mt-1">
                      <FaBolt className="text-xs" />
                    </span>
                    <span className="text-gray-600">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      {/* <section className="py-20 bg-blue-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div
            className="text-center mb-16"
          >
            <div className="inline-flex items-center bg-white px-6 py-3 rounded-full shadow-sm border border-blue-200 mb-6">
              <FaUsers className="text-yellow-500 mr-2" />
              <span className="font-medium text-blue-900">Meet The Team</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-blue-900 mb-4">Our Expert Electricians</h2>
            <p className="text-gray-600 max-w-3xl mx-auto">
              Skilled professionals dedicated to electrical excellence
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-2xl mx-auto">
            {[
              {
                name: "Raj Patel",
                role: "Founder & Master Electrician",
                image: "https://randomuser.me/api/portraits/men/32.jpg",
                quote: "20+ years of electrical expertise"
              },
              {
                name: "Amit Sharma",
                role: "Lead Installation Specialist",
                image: "https://randomuser.me/api/portraits/men/44.jpg",
                quote: "Commercial electrical systems expert"
              }
            ].map((member, index) => (
              <div
                key={index}
                className="bg-white rounded-xl shadow-lg overflow-hidden"
              >
                <div className="h-64 overflow-hidden">
                  <img 
                    src={member.image} 
                    alt={member.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-6 text-center">
                  <h3 className="text-xl font-bold text-blue-900">{member.name}</h3>
                  <p className="text-yellow-500 font-medium mb-3">{member.role}</p>
                  <p className="text-gray-600 italic">"{member.quote}"</p>
                  <div className="mt-4 flex justify-center space-x-4">
                    {[FaTwitter, FaLinkedin].map((Icon, i) => (
                      <a 
                        key={i} 
                        href="#" 
                        className="w-8 h-8 bg-blue-100 hover:bg-yellow-400 rounded-full flex items-center justify-center transition-colors"
                      >
                        <Icon className="text-blue-900 hover:text-white text-sm" />
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section> */}

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-blue-900 to-indigo-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold mb-6">Need Professional Electrical Services?</h2>
            <p className="text-xl text-blue-200 max-w-3xl mx-auto mb-8">
              Contact us today for reliable solutions from certified electricians.
            </p>
            <button
              className="bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-blue-900 font-bold py-4 px-8 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 inline-flex items-center"
            >
              <FaBolt className="mr-2" /> Get Your Free Consultation
            </button>
          </div>
        </div>
      </section>
      <br/>
    </div>
  );
};

export default AboutPage;