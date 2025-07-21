document.addEventListener('DOMContentLoaded', () => {
  // 1. Header Scroll Effect
  const header = document.querySelector('.header');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    });
  }

  // 2. Animate sections on scroll
  const sectionsToAnimate = document.querySelectorAll('.recommended-facilities, .nearby-facilities, .provider-cta');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  sectionsToAnimate.forEach(section => {
    section.classList.add('fade-in-section');
    observer.observe(section);
  });

  // 3. Placeholder for interactive elements
  const showPlaceholderAlert = (message) => {
    alert(message);
  };

  // Enable location button
  const enableLocationBtn = document.querySelector('.enable-location');
  if (enableLocationBtn) {
    enableLocationBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showPlaceholderAlert('Location detection functionality is not yet implemented.');
    });
  }

  // Book appointment buttons
  const bookingButtons = document.querySelectorAll('.book-appointment');
  bookingButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const facilityName = e.target.getAttribute('data-facility');
      showPlaceholderAlert(`Booking for "${facilityName}" is not yet implemented.`);
    });
  });

}); 