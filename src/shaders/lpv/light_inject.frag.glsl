#version 300 es
precision highp float;

struct RSMTexel {
	vec3 world_position;
	vec3 world_normal;
	vec4 flux;
};

in RSMTexel v_rsmTexel;

out vec4 fragColor;

void main()
{
	fragColor = v_rsmTexel.flux;
}
