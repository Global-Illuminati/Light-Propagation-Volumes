#ifndef COMMON_GLSL
#define COMMON_GLSL

layout(std140) uniform SceneUniforms {
	vec4 u_ambient_color;
	//
	vec4 u_directional_light_color;
	vec4 u_directional_light_direction;
};

#endif // COMMON_GLSL
