
export function initializeGameControls(controlType) {
    const player = document.querySelector('.player');
    const gameContainer = document.querySelector('.game-container');
    const tutorialBox = document.querySelector('.tutorial-box');
    let containerWidth = gameContainer.offsetWidth;
    let containerHeight = gameContainer.offsetHeight - 50;
    const collectibleCount = 9;
    const collectibles = [];
    let direction = { x: 1, y: 0 }; 
    const playerSpeed = 3;
    let playerX = 0;
    let playerY = containerHeight / 2 - 15; 
    const keysPressed = {}; 
    let lastDiagonalDirection = null; 
    let touchStartX = null; 
    let touchStartY = null; 

    
    const tutorialRect = {
        left: 0,
        top: 0,
        right: tutorialBox.offsetWidth,
        bottom: tutorialBox.offsetHeight,
    };

    
    player.style.left = `${playerX}px`;
    player.style.top = `${playerY}px`;

    
	function updateContainerDimensions() {
		containerWidth = gameContainer.offsetWidth;
		containerHeight = gameContainer.offsetHeight - 50;
	
		
		tutorialRect.left = tutorialBox.offsetLeft;
		tutorialRect.top = tutorialBox.offsetTop;
		tutorialRect.right = tutorialBox.offsetLeft + tutorialBox.offsetWidth;
		tutorialRect.bottom = tutorialBox.offsetTop + tutorialBox.offsetHeight;
	
		
		collectibles.forEach((collectible) => {
			let collectibleX = parseFloat(collectible.style.left);
			let collectibleY = parseFloat(collectible.style.top);
	
			
			if (collectibleX + 30 > containerWidth) {
				collectibleX = containerWidth - 30;
			}
			if (collectibleY + 30 > containerHeight) {
				collectibleY = containerHeight - 30;
			}
	
			
			if (
				collectibleX + 30 > tutorialRect.left &&
				collectibleX < tutorialRect.right &&
				collectibleY + 30 > tutorialRect.top &&
				collectibleY < tutorialRect.bottom
			) {
				
				const spaceLeft = tutorialRect.left;
				const spaceRight = containerWidth - tutorialRect.right;
				const spaceTop = tutorialRect.top;
				const spaceBottom = containerHeight - tutorialRect.bottom;
	
				if (spaceRight >= 30) {
					
					collectibleX = tutorialRect.right + 1;
					collectibleY = Math.random() * (containerHeight - 30);
					collectibleY = Math.max(
						Math.min(collectibleY, containerHeight - 30),
						0
					);
				} else if (spaceLeft >= 30) {
					
					collectibleX = tutorialRect.left - 30 - 1;
					collectibleY = Math.random() * (containerHeight - 30);
					collectibleY = Math.max(
						Math.min(collectibleY, containerHeight - 30),
						0
					);
				} else if (spaceBottom >= 30) {
					
					collectibleY = tutorialRect.bottom + 1;
					collectibleX = Math.random() * (containerWidth - 30);
					collectibleX = Math.max(
						Math.min(collectibleX, containerWidth - 30),
						0
					);
				} else if (spaceTop >= 30) {
					
					collectibleY = tutorialRect.top - 30 - 1;
					collectibleX = Math.random() * (containerWidth - 30);
					collectibleX = Math.max(
						Math.min(collectibleX, containerWidth - 30),
						0
					);
				} else {
					
					collectible.style.display = 'none';
					return;
				}
			}
	
			
			collectibleX = Math.min(
				Math.max(collectibleX, 0),
				containerWidth - 30
			);
			collectibleY = Math.min(
				Math.max(collectibleY, 0),
				containerHeight - 30
			);
	
			
			collectible.style.left = `${collectibleX}px`;
			collectible.style.top = `${collectibleY}px`;
	
			
			if (
				containerWidth <= tutorialRect.right &&
				containerHeight <= tutorialRect.bottom
			) {
				collectible.style.display = 'none'; 
			} else {
				collectible.style.display = ''; 
			}
		});
	
		
		if (playerX + player.offsetWidth > containerWidth) {
			playerX = containerWidth - player.offsetWidth;
		}
		if (playerY + player.offsetHeight > containerHeight) {
			playerY = containerHeight - player.offsetHeight;
		}
		if (playerX < 0) {
			playerX = 0;
		}
		if (playerY < 0) {
			playerY = 0;
		}
	
		player.style.left = `${playerX}px`;
		player.style.top = `${playerY}px`;
	}
	

    function createCollectibles() {
        collectibles.forEach((col) => col.remove()); 
        collectibles.length = 0;

        for (let i = 0; i < collectibleCount; i++) {
            let collectible;
            let isValidPosition = false;

            while (!isValidPosition) {
                collectible = document.createElement('div');
                collectible.className = 'collectible';
                const randomX = Math.random() * (containerWidth - 30);
                const randomY = Math.random() * (containerHeight - 30);

                
                if (
                    !(
                        randomX >= tutorialRect.left &&
                        randomX <= tutorialRect.right &&
                        randomY >= tutorialRect.top &&
                        randomY <= tutorialRect.bottom
                    )
                ) {
                    isValidPosition = true;
                    collectible.style.left = `${randomX}px`;
                    collectible.style.top = `${randomY}px`;
                    gameContainer.appendChild(collectible);
                    collectibles.push(collectible);
                }
            }
        }
    }

    function movePlayer() {
        const length = Math.sqrt(direction.x ** 2 + direction.y ** 2);
        const normalizedDirection = {
            x: (direction.x / length) * playerSpeed,
            y: (direction.y / length) * playerSpeed,
        };

        playerX += normalizedDirection.x;
        playerY += normalizedDirection.y;

        if (playerX < 0) {
            playerX = containerWidth - player.offsetWidth;
        } else if (playerX > containerWidth - player.offsetWidth) {
            playerX = 0;
        }

        if (playerY < 0) {
            playerY = containerHeight - player.offsetHeight;
        } else if (playerY > containerHeight - player.offsetHeight) {
            playerY = 0;
        }

        
        if (
            playerX + player.offsetWidth >= tutorialRect.left &&
            playerX <= tutorialRect.right &&
            playerY + player.offsetHeight >= tutorialRect.top &&
            playerY <= tutorialRect.bottom
        ) {
            
            if (direction.x > 0) {
                playerX = tutorialRect.right; 
            } else if (direction.x < 0) {
                playerX = tutorialRect.left - player.offsetWidth; 
            }

            if (direction.y > 0) {
                playerY = tutorialRect.bottom; 
            } else if (direction.y < 0) {
                playerY = tutorialRect.top - player.offsetHeight; 
            }
        }

        player.style.left = `${playerX}px`;
        player.style.top = `${playerY}px`;

        collectibles.forEach((collectible, index) => {
            const collectibleRect = collectible.getBoundingClientRect();
            const playerRect = player.getBoundingClientRect();

            if (
                playerRect.left < collectibleRect.right &&
                playerRect.right > collectibleRect.left &&
                playerRect.top < collectibleRect.bottom &&
                playerRect.bottom > collectibleRect.top
            ) {
                collectible.remove();
                collectibles.splice(index, 1);

                if (collectibles.length === 0) {
                    setTimeout(createCollectibles, 500);
                }
            }
        });
    }

    
    function updateDirection() {
        if (keysPressed['ArrowUp'] && keysPressed['ArrowLeft']) {
            direction = { x: -1, y: -1 };
            lastDiagonalDirection = { x: -1, y: -1 };
        } else if (keysPressed['ArrowUp'] && keysPressed['ArrowRight']) {
            direction = { x: 1, y: -1 };
            lastDiagonalDirection = { x: 1, y: -1 };
        } else if (keysPressed['ArrowDown'] && keysPressed['ArrowLeft']) {
            direction = { x: -1, y: 1 };
            lastDiagonalDirection = { x: -1, y: 1 };
        } else if (keysPressed['ArrowDown'] && keysPressed['ArrowRight']) {
            direction = { x: 1, y: 1 };
            lastDiagonalDirection = { x: 1, y: 1 };
        } else if (keysPressed['ArrowUp']) {
            direction = { x: 0, y: -1 };
        } else if (keysPressed['ArrowDown']) {
            direction = { x: 0, y: 1 };
        } else if (keysPressed['ArrowLeft']) {
            direction = { x: -1, y: 0 };
        } else if (keysPressed['ArrowRight']) {
            direction = { x: 1, y: 0 };
        } else if (lastDiagonalDirection) {
            direction = lastDiagonalDirection;
        }
        lastDiagonalDirection = direction;
    }

    function handleTouchStart(event) {
        const touch = event.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
    }

    function handleTouchMove(event) {
        if (!touchStartX || !touchStartY) return;

        const touchEndX = event.touches[0].clientX;
        const touchEndY = event.touches[0].clientY;

        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;

        const threshold = 5;

        if (Math.abs(diffX) > Math.abs(diffY)) {
            direction = { x: diffX > 0 ? 1 : -1, y: 0 };
        } else {
            direction = { x: 0, y: diffY > 0 ? 1 : -1 };
        }

        touchStartX = touchEndX;
        touchStartY = touchEndY;
    }

    if (controlType === 'keyboard') {
        document.addEventListener('keydown', (e) => {
            keysPressed[e.key] = true;
            updateDirection();
        });

        document.addEventListener('keyup', (e) => {
            keysPressed[e.key] = false;
        });
    }

    function gameLoop() {
        movePlayer();
        requestAnimationFrame(gameLoop);
    }

    if (controlType === 'touch') {
        gameContainer.addEventListener('touchstart', handleTouchStart, { passive: false });
        gameContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
    }

    window.addEventListener('resize', () => {
        updateContainerDimensions();
    });

    updateContainerDimensions();
    createCollectibles();
    gameLoop();
}
