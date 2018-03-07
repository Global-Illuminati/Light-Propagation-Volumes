#version 300 es

#include <common.glsl>
#define CELLSIZE 32.0
#define CELL_DIMH 16.0

layout(location = 0) in vec3 a_point_position;

uniform int u_rsm_size;
uniform sampler2D u_rsm_flux;
uniform sampler2D u_rsm_world_positions;
uniform sampler2D u_rsm_world_normals;

uniform mat4 u_world_from_local;
uniform mat4 u_view_from_world;
uniform mat4 u_projection_from_view;

struct RSMTexel {
	vec3 world_position;
	vec3 world_normal;
	vec4 flux;
};

out RSMTexel v_rsmTexel;

RSMTexel getRSMTexel(ivec2 texCoord) {
	RSMTexel texel;
	texel.world_normal = texelFetch(u_rsm_world_normals, texCoord, 0).xyz;
	texel.world_position = texelFetch(u_rsm_world_positions, texCoord, 0).xyz + 0.5 * texel.world_normal;
	texel.flux = texelFetch(u_rsm_flux, texCoord, 0);
	return texel;
}

void main()
{
	ivec2 rsmTexCoords = ivec2(gl_VertexID % u_rsm_size, gl_VertexID / u_rsm_size);
	vec4 pos = (u_projection_from_view * u_view_from_world * u_world_from_local * vec4(a_point_position, 1.0));

	v_rsmTexel = getRSMTexel(rsmTexCoords);

	gl_PointSize = 8.0;
	gl_Position = u_projection_from_view * u_view_from_world * vec4(v_rsmTexel.world_position, 1.0);
}
