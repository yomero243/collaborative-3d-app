// Dimensiones de la mesa
export const TABLE_WIDTH = 10;
export const TABLE_HEIGHT = 0.2;
export const TABLE_DEPTH = 6;

// Dimensiones de objetos
export const PADDLE_RADIUS = 0.5;
export const PUCK_RADIUS = 0.25;

// Constantes de físicas mejoradas
export const PUCK_FRICTION = 0.995;           // Fricción más realista
export const WALL_BOUNCE_FACTOR = 0.82;      // Rebotes de pared con más pérdida de energía
export const MIN_SPEED_THRESHOLD = 0.002;    // Umbral mínimo de velocidad
export const PADDLE_BOUNCE_FACTOR = 1.15;    // Factor de rebote de paddle más controlado
export const MAX_PUCK_SPEED = 18.0;          // Velocidad máxima aumentada
export const MIN_PUCK_SPEED = 0.12;          // Velocidad mínima para impulsos

// Nuevas constantes para el sistema mejorado
export const PUCK_MASS = 1.0;                // Masa del puck
export const PADDLE_MASS = 10.0;             // Masa efectiva del paddle
export const RESTITUTION_PUCK = 0.85;        // Coeficiente de restitución del puck
export const RESTITUTION_PADDLE = 0.92;      // Coeficiente de restitución del paddle
export const RESTITUTION_WALL = 0.78;        // Coeficiente de restitución de las paredes

// Constantes de efectos avanzados
export const MAGNUS_COEFFICIENT = 0.08;      // Efecto Magnus para el spin
export const ANGULAR_FRICTION = 0.98;        // Fricción angular
export const MAX_ANGULAR_VELOCITY = 12.0;    // Velocidad angular máxima
export const MAX_SPIN = 6.0;                 // Spin máximo

// Constantes de renderizado y suavizado
export const INTERPOLATION_FACTOR = 0.15;    // Factor de interpolación para rendering suave
export const COLLISION_SEPARATION = 0.005;   // Separación mínima en colisiones
export const VELOCITY_SMOOTHING = 0.8;       // Suavizado de velocidad de paddles

// Umbrales de detección
export const COLLISION_VELOCITY_THRESHOLD = 0.3;  // Umbral para detectar colisiones significativas
export const HIGH_SPEED_THRESHOLD = 5.0;          // Umbral de alta velocidad para efectos visuales

// Constantes para efectos visuales del Puck
export const PUCK_VISUAL_LERP_FACTOR = 0.3;       // Factor de interpolación para movimiento visual
export const PUCK_SNAP_THRESHOLD_MULTIPLIER = 8;   // Multiplicador del radio para snap de posición
export const PUCK_ROTATION_SPEED_FACTOR = 1.2;     // Factor de velocidad de rotación
export const PUCK_TILT_BASE_FACTOR = 0.08;         // Factor base de inclinación
export const PUCK_SPIN_TILT_FACTOR = 0.02;         // Factor de inclinación por spin
