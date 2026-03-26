/**
 * ImageCropper - Interactive image cropping tool
 * Allows users to select a thumbnail region from a full-size image
 */

export class ImageCropper {
  constructor(container, options = {}) {
    this.container = container;
    this.aspectRatio = options.aspectRatio || 4 / 3;
    this.minWidth = options.minWidth || 100;
    this.outputWidth = options.outputWidth || 600;
    this.outputHeight = options.outputHeight || 450;

    this.image = null;
    this.imageEl = null;
    this.cropBox = null;
    this.isDragging = false;
    this.isResizing = false;
    this.resizeHandle = null;
    this.startX = 0;
    this.startY = 0;
    this.startLeft = 0;
    this.startTop = 0;
    this.startWidth = 0;
    this.startHeight = 0;

    this.cropArea = { x: 0, y: 0, width: 0, height: 0 };
    this.scale = 1;
    this.displayedWidth = 0;
    this.displayedHeight = 0;

    this.init();
  }

  init() {
    // Create cropper structure
    this.container.innerHTML = `
      <div class="cropper-wrapper">
        <div class="cropper-image-container">
          <img class="cropper-image" alt="Image to crop">
          <div class="cropper-box">
            <div class="cropper-view-box">
              <img class="cropper-box-image" alt="">
            </div>
            <div class="cropper-handle cropper-handle-nw" data-handle="nw"></div>
            <div class="cropper-handle cropper-handle-ne" data-handle="ne"></div>
            <div class="cropper-handle cropper-handle-sw" data-handle="sw"></div>
            <div class="cropper-handle cropper-handle-se" data-handle="se"></div>
          </div>
        </div>
        <p class="cropper-hint">Versleep het selectiekader om de thumbnail te kiezen</p>
      </div>
    `;

    this.wrapper = this.container.querySelector('.cropper-wrapper');
    this.imageContainer = this.container.querySelector('.cropper-image-container');
    this.imageEl = this.container.querySelector('.cropper-image');
    this.cropBox = this.container.querySelector('.cropper-box');
    this.cropBoxImage = this.container.querySelector('.cropper-box-image');

    this.bindEvents();
  }

  bindEvents() {
    // Mouse events for crop box dragging
    this.cropBox.addEventListener('mousedown', (e) => this.onMouseDown(e));
    document.addEventListener('mousemove', (e) => this.onMouseMove(e));
    document.addEventListener('mouseup', () => this.onMouseUp());

    // Touch events for mobile
    this.cropBox.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
    document.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    document.addEventListener('touchend', () => this.onMouseUp());

    // Handle resize
    const handles = this.container.querySelectorAll('.cropper-handle');
    handles.forEach(handle => {
      handle.addEventListener('mousedown', (e) => this.onResizeStart(e));
      handle.addEventListener('touchstart', (e) => this.onResizeTouchStart(e), { passive: false });
    });
  }

  setImage(imageSrc) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        this.image = img;
        this.imageEl.src = imageSrc;
        this.cropBoxImage.src = imageSrc;

        // Show wrapper first so it has layout
        this.wrapper.style.display = 'block';

        // Wait for layout to stabilize then initialize
        const initializeCropper = () => {
          this.calculateScale();
          if (this.displayedWidth > 0 && this.displayedHeight > 0) {
            this.initCropBox();
            resolve();
          } else {
            // Retry after a short delay if dimensions still not available
            setTimeout(() => {
              this.calculateScale();
              this.initCropBox();
              resolve();
            }, 100);
          }
        };

        // Use multiple RAF + timeout to ensure layout is complete
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTimeout(initializeCropper, 50);
          });
        });
      };

      img.onerror = reject;
      img.src = imageSrc;
    });
  }

  calculateScale() {
    // Get the actual displayed dimensions of the image
    const rect = this.imageEl.getBoundingClientRect();
    let displayedWidth = rect.width;
    let displayedHeight = rect.height;

    // Also try offsetWidth/Height as fallback
    if (displayedWidth === 0 || displayedHeight === 0) {
      displayedWidth = this.imageEl.offsetWidth;
      displayedHeight = this.imageEl.offsetHeight;
    }

    // If dimensions are still 0, calculate based on natural size and CSS constraints
    if (displayedWidth === 0 || displayedHeight === 0) {
      const naturalWidth = this.image.naturalWidth;
      const naturalHeight = this.image.naturalHeight;

      // Get the modal/container width (fallback to 500px)
      const modalBody = this.container.closest('.modal-body');
      const maxWidth = modalBody ? modalBody.offsetWidth - 48 : 500; // 48px for padding
      const maxHeight = 400; // CSS max-height

      // Calculate displayed size respecting both constraints
      let scale = 1;
      if (naturalWidth > maxWidth) {
        scale = maxWidth / naturalWidth;
      }
      if (naturalHeight * scale > maxHeight) {
        scale = maxHeight / naturalHeight;
      }

      displayedWidth = naturalWidth * scale;
      displayedHeight = naturalHeight * scale;
    }

    this.displayedWidth = displayedWidth;
    this.displayedHeight = displayedHeight;

    // Calculate the scale between displayed image and original
    this.scale = this.image.naturalWidth / this.displayedWidth;

    console.log('Cropper dimensions:', {
      displayed: { width: this.displayedWidth, height: this.displayedHeight },
      natural: { width: this.image.naturalWidth, height: this.image.naturalHeight },
      scale: this.scale
    });
  }

  initCropBox() {
    // Set initial crop box size (as large as possible while fitting in image)
    const containerWidth = this.displayedWidth;
    const containerHeight = this.displayedHeight;

    if (containerWidth === 0 || containerHeight === 0) {
      console.error('Container has no dimensions');
      return;
    }

    // Calculate the maximum crop box size that fits within the image
    // while maintaining the aspect ratio (4:3)
    let boxWidth, boxHeight;

    // Try fitting by width first (use 100% of width)
    boxWidth = containerWidth;
    boxHeight = boxWidth / this.aspectRatio;

    // If height exceeds image, fit by height instead
    if (boxHeight > containerHeight) {
      boxHeight = containerHeight;
      boxWidth = boxHeight * this.aspectRatio;
    }

    // Ensure minimum size
    boxWidth = Math.max(boxWidth, this.minWidth);
    boxHeight = Math.max(boxHeight, this.minWidth / this.aspectRatio);

    // Center the crop box
    const left = (containerWidth - boxWidth) / 2;
    const top = (containerHeight - boxHeight) / 2;

    console.log('Initial crop box:', {
      containerWidth, containerHeight,
      boxWidth, boxHeight,
      left, top,
      aspectRatio: this.aspectRatio
    });

    this.setCropBox(left, top, boxWidth, boxHeight);
  }

  setCropBox(left, top, width, height) {
    // Ensure we have valid dimensions
    if (!this.displayedWidth || !this.displayedHeight) {
      console.warn('setCropBox called before dimensions calculated');
      return;
    }

    // Constrain to image bounds
    width = Math.min(width, this.displayedWidth);
    height = Math.min(height, this.displayedHeight);
    left = Math.max(0, Math.min(left, this.displayedWidth - width));
    top = Math.max(0, Math.min(top, this.displayedHeight - height));

    // Apply to crop box
    this.cropBox.style.left = `${left}px`;
    this.cropBox.style.top = `${top}px`;
    this.cropBox.style.width = `${width}px`;
    this.cropBox.style.height = `${height}px`;

    // Update the image inside crop box to show the visible area
    this.cropBoxImage.style.width = `${this.displayedWidth}px`;
    this.cropBoxImage.style.height = `${this.displayedHeight}px`;
    this.cropBoxImage.style.marginLeft = `-${left}px`;
    this.cropBoxImage.style.marginTop = `-${top}px`;

    // Store crop area in original image coordinates
    this.cropArea = {
      x: Math.round(left * this.scale),
      y: Math.round(top * this.scale),
      width: Math.round(width * this.scale),
      height: Math.round(height * this.scale)
    };
  }

  onMouseDown(e) {
    if (e.target.classList.contains('cropper-handle')) return;

    e.preventDefault();
    this.isDragging = true;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.startLeft = this.cropBox.offsetLeft;
    this.startTop = this.cropBox.offsetTop;
    this.cropBox.style.cursor = 'grabbing';
  }

  onTouchStart(e) {
    if (e.target.classList.contains('cropper-handle')) return;

    e.preventDefault();
    const touch = e.touches[0];
    this.isDragging = true;
    this.startX = touch.clientX;
    this.startY = touch.clientY;
    this.startLeft = this.cropBox.offsetLeft;
    this.startTop = this.cropBox.offsetTop;
  }

  onMouseMove(e) {
    if (this.isDragging) {
      const dx = e.clientX - this.startX;
      const dy = e.clientY - this.startY;

      const newLeft = this.startLeft + dx;
      const newTop = this.startTop + dy;
      const width = this.cropBox.offsetWidth;
      const height = this.cropBox.offsetHeight;

      this.setCropBox(newLeft, newTop, width, height);
    } else if (this.isResizing) {
      this.handleResize(e.clientX, e.clientY);
    }
  }

  onTouchMove(e) {
    if (this.isDragging || this.isResizing) {
      e.preventDefault();
      const touch = e.touches[0];

      if (this.isDragging) {
        const dx = touch.clientX - this.startX;
        const dy = touch.clientY - this.startY;

        const newLeft = this.startLeft + dx;
        const newTop = this.startTop + dy;
        const width = this.cropBox.offsetWidth;
        const height = this.cropBox.offsetHeight;

        this.setCropBox(newLeft, newTop, width, height);
      } else if (this.isResizing) {
        this.handleResize(touch.clientX, touch.clientY);
      }
    }
  }

  onMouseUp() {
    this.isDragging = false;
    this.isResizing = false;
    this.resizeHandle = null;
    if (this.cropBox) {
      this.cropBox.style.cursor = 'move';
    }
  }

  onResizeStart(e) {
    e.preventDefault();
    e.stopPropagation();
    this.isResizing = true;
    this.resizeHandle = e.target.dataset.handle;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.startLeft = this.cropBox.offsetLeft;
    this.startTop = this.cropBox.offsetTop;
    this.startWidth = this.cropBox.offsetWidth;
    this.startHeight = this.cropBox.offsetHeight;
  }

  onResizeTouchStart(e) {
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    this.isResizing = true;
    this.resizeHandle = e.target.dataset.handle;
    this.startX = touch.clientX;
    this.startY = touch.clientY;
    this.startLeft = this.cropBox.offsetLeft;
    this.startTop = this.cropBox.offsetTop;
    this.startWidth = this.cropBox.offsetWidth;
    this.startHeight = this.cropBox.offsetHeight;
  }

  handleResize(clientX, clientY) {
    const dx = clientX - this.startX;
    const dy = clientY - this.startY;

    let newLeft = this.startLeft;
    let newTop = this.startTop;
    let newWidth = this.startWidth;
    let newHeight = this.startHeight;

    switch (this.resizeHandle) {
      case 'se': // Bottom-right
        newWidth = Math.max(this.minWidth, this.startWidth + dx);
        newHeight = newWidth / this.aspectRatio;
        break;
      case 'sw': // Bottom-left
        newWidth = Math.max(this.minWidth, this.startWidth - dx);
        newHeight = newWidth / this.aspectRatio;
        newLeft = this.startLeft + (this.startWidth - newWidth);
        break;
      case 'ne': // Top-right
        newWidth = Math.max(this.minWidth, this.startWidth + dx);
        newHeight = newWidth / this.aspectRatio;
        newTop = this.startTop + (this.startHeight - newHeight);
        break;
      case 'nw': // Top-left
        newWidth = Math.max(this.minWidth, this.startWidth - dx);
        newHeight = newWidth / this.aspectRatio;
        newLeft = this.startLeft + (this.startWidth - newWidth);
        newTop = this.startTop + (this.startHeight - newHeight);
        break;
    }

    // Constrain to image bounds
    if (newLeft < 0) {
      const excess = -newLeft;
      newLeft = 0;
      if (this.resizeHandle === 'sw' || this.resizeHandle === 'nw') {
        newWidth -= excess;
        newHeight = newWidth / this.aspectRatio;
      }
    }

    if (newTop < 0) {
      const excess = -newTop;
      newTop = 0;
      if (this.resizeHandle === 'ne' || this.resizeHandle === 'nw') {
        newHeight -= excess;
        newWidth = newHeight * this.aspectRatio;
      }
    }

    if (newLeft + newWidth > this.displayedWidth) {
      newWidth = this.displayedWidth - newLeft;
      newHeight = newWidth / this.aspectRatio;
    }

    if (newTop + newHeight > this.displayedHeight) {
      newHeight = this.displayedHeight - newTop;
      newWidth = newHeight * this.aspectRatio;
    }

    // Ensure minimum size
    if (newWidth >= this.minWidth && newHeight >= this.minWidth / this.aspectRatio) {
      this.setCropBox(newLeft, newTop, newWidth, newHeight);
    }
  }

  getCroppedImage(quality = 0.85) {
    if (!this.image) return null;

    const canvas = document.createElement('canvas');
    canvas.width = this.outputWidth;
    canvas.height = this.outputHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      this.image,
      this.cropArea.x,
      this.cropArea.y,
      this.cropArea.width,
      this.cropArea.height,
      0,
      0,
      this.outputWidth,
      this.outputHeight
    );

    return canvas.toDataURL('image/jpeg', quality);
  }

  getCroppedBlob(quality = 0.85) {
    return new Promise((resolve) => {
      if (!this.image) {
        resolve(null);
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = this.outputWidth;
      canvas.height = this.outputHeight;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(
        this.image,
        this.cropArea.x,
        this.cropArea.y,
        this.cropArea.width,
        this.cropArea.height,
        0,
        0,
        this.outputWidth,
        this.outputHeight
      );

      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/jpeg', quality);
    });
  }

  destroy() {
    this.container.innerHTML = '';
    this.image = null;
  }
}
