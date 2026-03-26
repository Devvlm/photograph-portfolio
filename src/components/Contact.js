/**
 * Contact Form Component
 * Handles form validation and submission
 */

export function initContact() {
  const form = document.getElementById('contactForm');
  const messageDiv = document.getElementById('formMessage');

  if (!form) return;

  // Form validation
  function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  function showMessage(type, text) {
    messageDiv.textContent = text;
    messageDiv.className = `form-message ${type}`;

    // Auto-hide after 5 seconds
    setTimeout(() => {
      messageDiv.className = 'form-message';
      messageDiv.textContent = '';
    }, 5000);
  }

  function validateForm(formData) {
    const errors = [];

    if (!formData.name || formData.name.trim().length < 2) {
      errors.push(window.i18n.t('contact.form.errors.nameRequired'));
    }

    if (!formData.email || !validateEmail(formData.email)) {
      errors.push(window.i18n.t('contact.form.errors.emailRequired'));
    }

    if (!formData.subject || formData.subject.trim().length < 2) {
      errors.push(window.i18n.t('contact.form.errors.subjectRequired'));
    }

    if (!formData.message || formData.message.trim().length < 10) {
      errors.push(window.i18n.t('contact.form.errors.messageRequired'));
    }

    return errors;
  }

  // Form submission
  async function handleSubmit(e) {
    e.preventDefault();

    const formData = {
      name: form.querySelector('#name').value,
      email: form.querySelector('#email').value,
      subject: form.querySelector('#subject').value,
      message: form.querySelector('#message').value,
    };

    // Validate
    const errors = validateForm(formData);
    if (errors.length > 0) {
      showMessage('error', errors[0]);
      return;
    }

    // Disable submit button
    const submitBtn = form.querySelector('.form-submit');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = window.i18n.t('contact.form.sending');
    submitBtn.disabled = true;

    try {
      const apiUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiUrl}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        showMessage('success', window.i18n.t('contact.form.success'));
        form.reset();
      } else {
        const data = await res.json().catch(() => ({}));
        const msg = data.error || window.i18n.t('contact.form.errors.serverError');
        showMessage('error', msg);
      }
    } catch {
      showMessage('error', window.i18n.t('contact.form.errors.serverError'));
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  }

  // Disable default browser validation popups
  function disableDefaultValidation() {
    const inputs = form.querySelectorAll('.form-input, .form-textarea');
    inputs.forEach(input => {
      // Disable default validation behavior
      input.addEventListener('invalid', (e) => {
        e.preventDefault();
        return false;
      });
      
      // Set custom validation messages for better UX
      if (input.id === 'name') {
        input.addEventListener('invalid', (e) => {
          e.preventDefault();
          if (!input.value.trim()) {
            showMessage('error', window.i18n.t('contact.form.errors.nameRequired'));
          } else if (input.value.trim().length < 2) {
            showMessage('error', window.i18n.t('contact.form.errors.nameMinLength'));
          }
        });
      }
      
      if (input.id === 'email') {
        input.addEventListener('invalid', (e) => {
          e.preventDefault();
          showMessage('error', window.i18n.t('contact.form.errors.emailRequired'));
        });
      }
      
      if (input.id === 'subject') {
        input.addEventListener('invalid', (e) => {
          e.preventDefault();
          if (!input.value.trim()) {
            showMessage('error', window.i18n.t('contact.form.errors.subjectRequired'));
          } else if (input.value.trim().length < 2) {
            showMessage('error', window.i18n.t('contact.form.errors.subjectMinLength'));
          }
        });
      }

      if (input.id === 'message') {
        input.addEventListener('invalid', (e) => {
          e.preventDefault();
          if (!input.value.trim()) {
            showMessage('error', window.i18n.t('contact.form.errors.messageRequired'));
          } else if (input.value.trim().length < 10) {
            showMessage('error', window.i18n.t('contact.form.errors.messageMinLength'));
          }
        });
      }
    });
  }

  // Real-time validation feedback
  function handleInputBlur(e) {
    const input = e.target;
    const value = input.value.trim();

    if (input.type === 'email' && value && !validateEmail(value)) {
      input.style.borderColor = 'var(--accent-primary)';
    } else if (input.required && !value) {
      input.style.borderColor = 'var(--accent-primary)';
    } else {
      input.style.borderColor = '';
    }
  }

  function handleInputFocus(e) {
    e.target.style.borderColor = '';
  }

  // Event listeners
  form.addEventListener('submit', handleSubmit);
  
  // Disable default validation popups
  disableDefaultValidation();

  const inputs = form.querySelectorAll('.form-input, .form-textarea');
  inputs.forEach(input => {
    input.addEventListener('blur', handleInputBlur);
    input.addEventListener('focus', handleInputFocus);
  });
}
