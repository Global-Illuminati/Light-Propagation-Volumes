#version 300 es
precision highp float;

#define PI 3.1415926f

#include <lpv_common.glsl>

layout(location = 0) out vec4 o_red_color;
layout(location = 1) out vec4 o_green_color;
layout(location = 2) out vec4 o_blue_color;

struct RSMTexel {
	vec3 world_position;
	vec3 world_normal;
	vec4 flux;
};

in RSMTexel v_rsm_texel;

//#define DEBUG_RENDER

void main()
{
	vec4 SH_coeffs = evalCosineLobeToDir(v_rsm_texel.world_normal);
	vec4 shR = SH_coeffs * v_rsm_texel.flux.r;
	vec4 shG = SH_coeffs * v_rsm_texel.flux.g;
	vec4 shB = SH_coeffs * v_rsm_texel.flux.b;

#ifdef DEBUG_RENDER
	o_red_color = vec4(normalize(shR.xyz),1.0);
	o_green_color = vec4(normalize(shG.xyz),1.0);
	o_blue_color = vec4(normalize(shB.xyz),1.0);
#else
	o_red_color = shR;
	o_green_color = shG;
	o_blue_color = shB;
#endif
}
