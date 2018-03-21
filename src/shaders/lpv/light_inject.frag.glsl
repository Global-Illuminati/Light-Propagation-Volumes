#version 300 es
precision highp float;

#define PI 3.1415926f

#define SH_C0 0.282094792f // 1 / 2sqrt(pi)
#define SH_C1 0.488602512f // sqrt(3/pi) / 2

/*Cosine lobe coeff*/
#define SH_cosLobe_C0 0.886226925f // sqrt(pi)/2 
#define SH_cosLobe_C1 1.02332671f // sqrt(pi/3) 

layout(location = 0) out vec4 o_red_color;
layout(location = 1) out vec4 o_green_color;
layout(location = 2) out vec4 o_blue_color;

struct RSMTexel {
	vec3 world_position;
	vec3 world_normal;
	vec4 flux;
};

in RSMTexel v_rsm_texel;

vec4 evalCosineLobeToDir(vec3 dir) {
	//f00, f-11, f01, f11
	return vec4( SH_cosLobe_C0, -SH_cosLobe_C1 * dir.y, SH_cosLobe_C1 * dir.z, -SH_cosLobe_C1 * dir.x );
}

#define DEBUG_RENDER

void main()
{
	vec4 SH_coeffs = evalCosineLobeToDir(v_rsm_texel.world_normal) / PI;
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
