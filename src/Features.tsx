import React from 'react';
import './Features.css';

const Features: React.FC = () => (
  <section className="features" id="features" aria-labelledby="features-title">
    <h2 id="features-title" style={{ fontSize: '3rem', fontWeight: 800, textAlign: 'center', marginBottom: '2rem' }}>
      Data-driven insights that support your care.
    </h2>
    <p style={{
      maxWidth: '900px',
      margin: '0 auto',
      fontSize: '1.5rem',
      color: '#475569',
      textAlign: 'center',
      fontWeight: 400,
      fontFamily: 'Open Sans',
      lineHeight: 1.5
    }}>
      AllerGEN AI enhances clinical efficiency through structured patient-reported data, leveraging evidence-based allergen databases and our cross-reactivity algorithms to deliver precise diagnostic insights and improve patient outcomes.
    </p>
  </section>
);

export default Features; 