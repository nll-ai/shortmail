document.addEventListener('DOMContentLoaded', function() {
    const copyButton = document.getElementById('copy-button');
    if (copyButton) {
        copyButton.addEventListener('click', copyShareUrl);
    }

    document.querySelectorAll('.edit-faq').forEach(button => {
        button.addEventListener('click', showEditForm);
    });

    document.querySelectorAll('.cancel-edit').forEach(button => {
        button.addEventListener('click', hideEditForm);
    });
});

function copyShareUrl() {
    const shareUrl = document.querySelector('.share-url a').href;
    const tempInput = document.createElement('input');
    tempInput.value = shareUrl;
    document.body.appendChild(tempInput);
    tempInput.select();

    try {
        const successful = document.execCommand('copy');
        const msg = successful ? 'successful' : 'unsuccessful';
        console.log('Copying text command was ' + msg);

        if (successful) {
            updateCopyButton(this);
        } else {
            console.error('Failed to copy');
        }
    } catch (err) {
        console.error('Oops, unable to copy', err);
    }

    document.body.removeChild(tempInput);
}

function updateCopyButton(button) {
    const icon = button.querySelector('i');
    icon.classList.remove('fa-copy');
    icon.classList.add('fa-check');
    button.classList.add('copied');

    setTimeout(() => {
        icon.classList.remove('fa-check');
        icon.classList.add('fa-copy');
        button.classList.remove('copied');
    }, 2000);
}

function showEditForm() {
    const faqItem = this.closest('.faq-item');
    faqItem.querySelector('.faq-content').style.display = 'none';
    faqItem.querySelector('.remove-faq-form').style.display = 'none';
    faqItem.querySelector('.edit-faq-form').style.display = 'block';
}

function hideEditForm() {
    const faqItem = this.closest('.faq-item');
    faqItem.querySelector('.faq-content').style.display = 'block';
    faqItem.querySelector('.remove-faq-form').style.display = 'block';
    faqItem.querySelector('.edit-faq-form').style.display = 'none';
}
