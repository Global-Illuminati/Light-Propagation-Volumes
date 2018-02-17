#ifndef COMMON_GLSL
#define COMMON_GLSL

float saturate(float value) {
	return clamp(value, 0.0, 1.0);
}

#endif // COMMON_GLSL
