#version 300 es
precision highp float;

#define PI 3.1415926f

#define SH_C0 0.282094791f // 1 / 2sqrt(pi)
#define SH_C1 0.488602512f // sqrt(3/pi) / 2

/*Cosine lobe coeff*/
#define SH_cosLobe_C0 0.886226925f // sqrt(pi)/2
#define SH_cosLobe_C1 1.02332671f // sqrt(pi/3)

#define CELLSIZE 1.0

uniform highp int u_grid_size;

uniform sampler2D u_red_contribution;
uniform sampler2D u_green_contribution;
uniform sampler2D u_blue_contribution;

flat in ivec2 v_cell_index;

layout(location = 0) out vec4 o_red_color;
layout(location = 1) out vec4 o_green_color;
layout(location = 2) out vec4 o_blue_color;

vec4 red_contribution = vec4(0.0);
vec4 green_contribution = vec4(0.0);
vec4 blue_contribution = vec4(0.0);

const vec3 directions[] = vec3[](
    //z
    vec3(0,0,1), 
    vec3(0,0,-1), 
    //x
    vec3(1,0,0), 
    vec3(-1,0,0), 
    //y
    vec3(0,1,0), 
    vec3(0,-1,0)
);

// orientation = [ right | up | forward ] = [ x | y | z ]
const mat3 neighbourOrientations[6] = mat3[] (
    // Z+
    mat3(1, 0, 0,0, 1, 0,0, 0, 1),
    // Z-
    mat3(-1, 0, 0,0, 1, 0,0, 0, -1),
    // X+
    mat3(0, 0, 1,0, 1, 0,-1, 0, 0
        ),
    // X-
    mat3(0, 0, -1,0, 1, 0,1, 0, 0),
    // Y+
    mat3(1, 0, 0,0, 0, 1,0, -1, 0),
    // Y-
    mat3(1, 0, 0,0, 0, -1,0, 1, 0)
);

// Faces in cube
const ivec2 sideFaces[4] = ivec2[] (
    ivec2(1, 0),   // right
    ivec2(0, 1),   // up
    ivec2(-1, 0),  // left
    ivec2(0, -1)   // down
);

vec4 evalCosineLobeToDir(vec3 dir)
{
	return vec4(SH_cosLobe_C0, -SH_cosLobe_C1 * dir.y, SH_cosLobe_C1 * dir.z, -SH_cosLobe_C1 * dir.x);
}

// Get SH coeficients out of direction
vec4 dirToSH(vec3 dir)
{
    return vec4(SH_C0, -SH_C1 * dir.y, SH_C1 * dir.z, -SH_C1 * dir.x);
}

vec3 getEvalSideDirection(int index, mat3 orientation)
{
    const float smallComponent = 0.4472135; // 1 / sqrt(5)
    const float bigComponent = 0.894427; // 2 / sqrt(5)

    vec2 current_side = vec2(sideFaces[index]);
    return orientation * vec3(current_side.x * smallComponent, current_side.y * smallComponent, bigComponent);
}

vec3 getReprojSideDirection(int index, mat3 orientation)
{
    ivec2 current_side = sideFaces[index];
    return orientation * vec3(current_side.x, current_side.y, 0);
}

void propagate() {

    const float directFaceSubtendedSolidAngle = 0.4006696846f / PI;
	const float sideFaceSubtendedSolidAngle = 0.4234413544f / PI;

    // Add contributions of neighbours to this cell
    for(int neighbour = 0; neighbour < 6; neighbour++)
    {
        mat3 orientation = neighbourOrientations[neighbour];
        vec3 direction = orientation * vec3(0.0,0.0,1.0);

        //index offset in our flattened version of the lpv grid
        ivec2 index_offset = ivec2(
            directions[neighbour].x + (directions[neighbour].z * float(u_grid_size)), 
            directions[neighbour].y
        );

        ivec2 neighbour_index = v_cell_index - index_offset;

        vec4 red_contribution_neighbour = texelFetch(u_red_contribution, neighbour_index, 0);
        vec4 green_contribution_neighbour = texelFetch(u_green_contribution, neighbour_index, 0);
        vec4 blue_contribution_neighbour = texelFetch(u_blue_contribution, neighbour_index, 0);

        vec4 direction_cosine_lobe = evalCosineLobeToDir(direction);
        vec4 direction_spherical_harmonic = dirToSH(direction);

        red_contribution += max(0.0, dot( red_contribution_neighbour, direction_spherical_harmonic)) * direction_cosine_lobe;
        green_contribution += max(0.0, dot( green_contribution_neighbour, direction_spherical_harmonic)) * direction_cosine_lobe;
        blue_contribution += max(0.0, dot( blue_contribution_neighbour, direction_spherical_harmonic)) * direction_cosine_lobe;

        // Add contributions of faces of neighbour
        for(int face = 0; face < 4; face++)
        {
            vec3 eval_direction = getEvalSideDirection(face, orientation);
            vec3 reproj_direction = getReprojSideDirection(face, orientation);

            vec4 reproj_direction_cosine_lobe = evalCosineLobeToDir( reproj_direction );
			vec4 eval_direction_spherical_harmonic = dirToSH( eval_direction );
			
		    red_contribution += max(0.0, dot( red_contribution_neighbour, eval_direction_spherical_harmonic )) * reproj_direction_cosine_lobe;
			green_contribution += max(0.0, dot( green_contribution_neighbour, eval_direction_spherical_harmonic )) * reproj_direction_cosine_lobe;
			blue_contribution += max(0.0, dot( blue_contribution_neighbour, eval_direction_spherical_harmonic )) * reproj_direction_cosine_lobe;
        }
    }
}

void main()
{
    propagate();

    o_red_color += red_contribution;
    o_green_color += green_contribution;
    o_blue_color += blue_contribution;
}